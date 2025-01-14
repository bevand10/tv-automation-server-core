import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { logger } from '../logging'
import * as semver from 'semver'

export const SYSTEM_ID = 'core'
export interface ICoreSystem {
	_id: 'core'
	/** Timestamp of creation, (ie the time the database was created) */
	created: number
	/** Last modified time */
	modified: number
	/** Database version, on the form x.y.z */
	version: string
	/** Previous version, on the form x.y.z */
	previousVersion: string | null

	/** Id of the blueprint used by this system */
	blueprintId?: string

	/** File path to store persistant data (like snapshots, etc) */
	storePath: string

	/** Support info */
	support?: {
		message: string
	}

	systemInfo?: {
		message: string
		enabled: boolean
	}

	/** A user-defined name for the installation */
	name?: string
}

/** In the beginning, there was the database, and the database was with Sofie, and the database was Sofie.
 * And Sofie said: The version of the database is to be GENESIS_SYSTEM_VERSION so that the migration scripts will run.
 */
export const GENESIS_SYSTEM_VERSION = '0.0.0'

// The CoreSystem collection will contain one (exactly 1) object.
// This represents the "system"

export const CoreSystem: TransformedCollection<ICoreSystem, ICoreSystem>
	= new Mongo.Collection<ICoreSystem>('coreSystem')
registerCollection('CoreSystem', CoreSystem)

export function getCoreSystem (): ICoreSystem | undefined {
	return CoreSystem.findOne(SYSTEM_ID)
}
export function getCoreSystemCursor () {
	return CoreSystem.find(SYSTEM_ID)
}
export function setCoreSystemVersion (versionStr: string): string {
	let system = getCoreSystem()
	if (!system) throw new Meteor.Error(500, 'CoreSystem not found')

	if (!Meteor.isServer) throw new Meteor.Error(500, 'This function can only be run server-side')

	let version = parseVersion(versionStr)

	if (version === versionStr) {

		logger.info(`Updating database version, from "${system.version}" to "${version}".`)

		let previousVersion: string | null = null

		if (system.version && semver.gt(version, system.version)) { // the new version is higher than previous version
			previousVersion = system.version
		}

		CoreSystem.update(system._id, {$set: {
			version: versionStr,
			previousVersion: previousVersion
		}})
		return versionStr
	} else {
		throw new Meteor.Error(500, `Unable to set version. Parsed version differ from expected: "${versionStr}", "${version}"`)
	}
}
export function setCoreSystemStorePath (storePath: string): void {
	let system = getCoreSystem()
	if (!system) throw new Meteor.Error(500, 'CoreSystem not found')
	if (!Meteor.isServer) throw new Meteor.Error(500, 'This function can only be run server-side')

	storePath = (storePath + '').trim().replace(/(.*)[\/\\]$/, '$1') // remove last "/" or "\"

	CoreSystem.update(system._id, {$set: {
		storePath: storePath
	}})
}

export type Version = string
export type VersionRange = string

export function stripVersion (v: string): string {
	if (v.match(/git/i) || v.match(/http/i)) {
		return '0.0.0'
	} else {
		return v.replace(/[^\d.]/g,'') || '0.0.0'
	}
}
export function parseRange (r: string | VersionRange): VersionRange {
	if ((r + '').match(/git:\/\//)) {
		return '^0.0.0' // anything goes..
	}
	const range = semver.validRange(r)
	if (!range) throw new Meteor.Error(500, `Invalid range: "${r}"`)
	return range
}
export function parseVersion (v: string | Version): Version {
	if ((v + '').match(/git:\/\//)) {
		return '0.0.0' // fallback
	}
	const valid = semver.valid(v)
	if (!valid) throw new Meteor.Error(500, `Invalid version: "${v}"`)
	return valid
}
