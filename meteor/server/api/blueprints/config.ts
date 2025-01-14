import * as _ from 'underscore'
import { ConfigItemValue } from 'tv-automation-sofie-blueprints-integration'
import { Studios, Studio } from '../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import { getShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'

export namespace ConfigRef {
	export function getStudioConfigRef (studioId: string, configKey: string): string {
		return '${studio.' + studioId + '.' + configKey + '}'
	}
	export function getShowStyleConfigRef (showStyleVariantId: string, configKey: string): string {
		return '${showStyle.' + showStyleVariantId + '.' + configKey + '}'
	}
	export function retrieveRefs (stringWithReferences: string, modifier?: (str: string) => string, bailOnError?: boolean): string {
		if (!stringWithReferences) return stringWithReferences

		const refs = stringWithReferences.match(/\$\{[^}]+\}/g) || []
		_.each(refs, (ref) => {
			if (ref) {
				let value = retrieveRef(ref, bailOnError) + ''
				if (value) {
					if (modifier) value = modifier(value)
					stringWithReferences = stringWithReferences.replace(ref, value)
				}
			}
		})
		return stringWithReferences
	}
	function retrieveRef (reference: string, bailOnError?: boolean): ConfigItemValue | string | undefined {
		if (!reference) return undefined
		let m = reference.match(/\$\{([^.}]+)\.([^.}]+)\.([^.}]+)\}/)
		if (m) {
			if (
				m[1] === 'studio' &&
				_.isString(m[2]) &&
				_.isString(m[3])
			) {
				const studioId = m[2]
				const configId = m[3]
				const studio = Studios.findOne(studioId)
				if (studio) {
					return studio.getConfigValue(configId)
				} else if (bailOnError) throw new Meteor.Error(404,`Ref "${reference}": Studio "${studioId}" not found`)
			} else if (
				m[1] === 'showStyle' &&
				_.isString(m[2]) &&
				_.isString(m[3])
			) {
				const showStyleVariantId = m[2]
				const configId = m[3]
				const showStyleCompound = getShowStyleCompound(showStyleVariantId)
				if (showStyleCompound) {
					const config = _.find(showStyleCompound.config, (config) => {
						return config._id === configId
					})
					if (config) {
						return config.value
					} else if (bailOnError) throw new Meteor.Error(404,`Ref "${reference}": Showstyle variant "${showStyleVariantId}" not found`)
				}
			}
		}
		return undefined
	}
}

export function compileStudioConfig (studio: Studio) {
	const res: {[key: string]: ConfigItemValue} = {}
	_.each(studio.config, (c) => {
		res[c._id] = c.value
	})

	// Expose special values as defined in the studio
	res['SofieHostURL'] = studio.settings.sofieUrl

	return res
}
