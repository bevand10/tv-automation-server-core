import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { MigrationStepInput, MigrationStepInputFilteredResult, MigrationStepBase } from 'tv-automation-sofie-blueprints-integration'
import { Collections, objectPathGet } from '../../lib/lib'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { logger } from '../logging'
import { Studios, Studio } from '../../lib/collections/Studios'
import * as semver from 'semver'

/**
 * Returns a migration step that ensures the provided property is set in the collection
 * @param collectionName
 * @param selector
 * @param property
 * @param value
 * @param inputType
 * @param label
 * @param description
 * @param defaultValue
 */
export function ensureCollectionProperty<T = any> (
	collectionName: string,
	selector: Mongo.Selector<T>,
	property: string,
	value: any | null, // null if manual
	inputType?: 'text' | 'multiline' | 'int' | 'checkbox' | 'dropdown' | 'switch', // EditAttribute types
	label?: string,
	description?: string,
	defaultValue?: any,
	dependOnResultFrom?: string
): MigrationStepBase {
	let collection: Mongo.Collection<T> = Collections[collectionName]
	if (!collection) throw new Meteor.Error(404, `Collection ${collectionName} not found`)

	return {
		id: `${collectionName}.${property}`,
		canBeRunAutomatically: (_.isNull(value) ? false : true),
		validate: () => {
			let objects = collection.find(selector).fetch()
			let propertyMissing: string | boolean = false
			_.each(objects, (obj: any) => {
				let objValue = objectPathGet(obj, property)
				if (!objValue && objValue !== value) {
					propertyMissing = `${property} is missing on ${obj._id}`
				}
			})

			return propertyMissing
		},
		input: () => {
			let objects = collection.find(selector).fetch()

			let inputs: Array<MigrationStepInput> = []
			_.each(objects, (obj: any) => {

				let localLabel = (label + '').replace(/\$id/g, obj._id)
				let localDescription = (description + '').replace(/\$id/g, obj._id)
				if (inputType && !obj[property]) {
					inputs.push({
						label: localLabel,
						description: localDescription,
						inputType: inputType,
						attribute: obj._id,
						defaultValue: defaultValue
					})
				}
			})
			return inputs
		},
		migrate: (input: MigrationStepInputFilteredResult) => {

			if (value) {
				let objects = collection.find(selector).fetch()
				_.each(objects, (obj: any) => {
					if (obj && objectPathGet(obj, property) !== value) {
						let m = {}
						m[property] = value
						logger.info(`Migration: Setting ${collectionName} object "${obj._id}".${property} to ${value}`)
						collection.update(obj._id,{ $set: m })
					}
				})
			} else {
				_.each(input, (value, objectId: string) => {
					if (!_.isUndefined(value)) {
						let obj = collection.findOne(objectId)
						if (obj && objectPathGet(obj, property) !== value) {
							let m = {}
							m[property] = value
							logger.info(`Migration: Setting ${collectionName} object "${objectId}".${property} to ${value}`)
							collection.update(objectId,{ $set: m })
						}
					}
				})
			}
		},
		dependOnResultFrom: dependOnResultFrom
	}
}
export function ensureStudioConfig (
	configName: string,
	value: any | null, // null if manual
	inputType?: 'text' | 'multiline' | 'int' | 'checkbox' | 'dropdown' | 'switch', // EditAttribute types
	label?: string,
	description?: string,
	defaultValue?: any,
	dependOnResultFrom?: string
): MigrationStepBase {

	return {
		id: `studioConfig.${configName}`,
		canBeRunAutomatically: (_.isNull(value) ? false : true),
		dependOnResultFrom: dependOnResultFrom,
		validate: () => {
			let studios = Studios.find().fetch()
			let configMissing: string | boolean = false
			_.each(studios, (studio: Studio) => {
				let config = _.find(studio.config, (c) => {
					return c._id === configName
				})
				if (!config) {
					configMissing = `${configName} is missing on ${studio._id}`
				}
			})

			return configMissing
		},
		input: () => {
			let studios = Studios.find().fetch()

			let inputs: Array<MigrationStepInput> = []
			_.each(studios, (studio: Studio) => {
				let config = _.find(studio.config, (c) => {
					return c._id === configName
				})

				let localLabel = (label + '').replace(/\$id/g, studio._id)
				let localDescription = (description + '').replace(/\$id/g, studio._id)
				if (inputType && !studio[configName]) {
					inputs.push({
						label: localLabel,
						description: localDescription,
						inputType: inputType,
						attribute: studio._id,
						defaultValue: config && config.value ? config.value : defaultValue
					})
				}
			})
			return inputs
		},
		migrate: (input: MigrationStepInputFilteredResult) => {

			let studios = Studios.find().fetch()
			_.each(studios, (studio: Studio) => {
				let value2: any = undefined
				if (!_.isNull(value)) {
					value2 = value
				} else {
					value2 = input[studio._id]
				}
				if (!_.isUndefined(value2)) {
					let config = _.find(studio.config, (c) => {
						return c._id === configName
					})
					let doUpdate: boolean = false
					if (config) {
						if (config.value !== value2) {
							doUpdate = true
							config.value = value2
						}
					} else {
						doUpdate = true
						studio.config.push({
							_id: configName,
							value: value2
						})
					}
					if (doUpdate) {
						logger.info(`Migration: Setting Studio config "${configName}" to ${value2}`)
						Studios.update(studio._id,{$set: {
							config: studio.config
						}})
					}
				}
			})
		}
	}
}

export function setExpectedVersion (id, deviceType: PeripheralDeviceAPI.DeviceType, libraryName: string, versionStr: string): MigrationStepBase {
	return {
		id: id,
		canBeRunAutomatically: true,
		validate: () => {
			let devices = PeripheralDevices.find({
				type: deviceType,
				subType: PeripheralDeviceAPI.SUBTYPE_PROCESS
			}).fetch()

			for (let i in devices) {
				let device = devices[i]
				if (!device.expectedVersions) device.expectedVersions = {}

				let expectedVersion = semver.clean(device.expectedVersions[libraryName] || '0.0.0')

				if (expectedVersion) {
					try {
						if (semver.lt(expectedVersion, semver.clean(versionStr) || '0.0.0')) {
							return `Expected version ${libraryName}: ${expectedVersion} should be at least ${versionStr}`
						}
					} catch (e) {
						return 'Error: ' + e.toString()
					}
				} else return `Expected version ${libraryName}: not set`
			}
			return false
		},
		migrate: () => {
			let devices = PeripheralDevices.find({ type: deviceType }).fetch()

			_.each(devices, (device) => {
				if (!device.expectedVersions) device.expectedVersions = {}

				let expectedVersion = semver.clean(device.expectedVersions[libraryName] || '0.0.0')
				if (!expectedVersion || semver.lt(expectedVersion, semver.clean(versionStr) || '0.0.0')) {
					let m = {}
					m['expectedVersions.' + libraryName] = versionStr
					logger.info(`Migration: Updating expectedVersion ${libraryName} of device ${device._id} from "${expectedVersion}" to "${versionStr}"`)
					PeripheralDevices.update(device._id, { $set: m })
				}
			})
		},
		overrideSteps: [id]
	}
}

interface RenameContent {
	content: { [newValue: string]: string }
}
export function renamePropertiesInCollection<T extends any > (
	id: string,
	collection: Mongo.Collection<T>,
	collectionName: string,
	renames: Partial<{[newAttr in keyof T]: string | RenameContent}>,
	dependOnResultFrom?: string
) {
	const m: any = {
		$or: []
	}
	const oldNames: {[oldAttr: string]: string} = {}
	_.each(_.keys(renames), (newAttr) => {
		const oldAttr = renames[newAttr]
		if (_.isString(oldAttr)) {
			oldNames[oldAttr] = newAttr
		}
	})

	_.each(_.keys(renames), (newAttr) => {
		const oldAttr: string | RenameContent | undefined = renames[newAttr]
		if (oldAttr) {
			if (_.isString(oldAttr)) {
				const o = {}
				o[oldAttr] = { $exists: true }
				m.$or.push(o)
			} else {
				const oldAttrRenameContent: RenameContent = oldAttr // for some reason, tsc complains otherwise

				const oldAttrActual = oldNames[newAttr] || newAttr // If the attribute has been renamed, rename it here as well

				// Select where a value is of the old, to-be-replaced value:
				const o = {}
				o[oldAttrActual] = { $in: _.values(oldAttrRenameContent.content) }
				m.$or.push(o)
			}
		}
	})
	return {
		id: id,
		canBeRunAutomatically: true,
		dependOnResultFrom: dependOnResultFrom,
		validate: () => {
			const objCount = collection.find(m).count()
			if (objCount > 0) return `${objCount} documents in ${collectionName} needs to be updated`
			return false
		},
		migrate: () => {
			collection.find(m).forEach((doc) => {
				// Rename properties:
				_.each(_.keys(renames), (newAttr) => {
					const oldAttr: string | RenameContent | undefined = renames[newAttr]
					if (newAttr && oldAttr && newAttr !== oldAttr) {
						if (_.isString(oldAttr)) {

							if (_.has(doc, oldAttr) && !_.has(doc, newAttr)) {
								doc[newAttr] = doc[oldAttr]
							}
							delete doc[oldAttr]
						}
					}
				})
				// Translate property contents:
				_.each(_.keys(renames), (newAttr) => {
					const oldAttr: string | RenameContent | undefined = renames[newAttr]
					if (newAttr && oldAttr && newAttr !== oldAttr) {
						if (!_.isString(oldAttr)) {
							const oldAttrRenameContent: RenameContent = oldAttr // for some reason, tsc complains otherwise

							_.each(oldAttrRenameContent.content, (oldValue, newValue) => {

								if (doc[newAttr] === oldValue) {
									doc[newAttr] = newValue
								}

							})
						}
					}
				})
				collection.update(doc._id, doc)
			})
			//
		}
	}
}
