import { check } from 'meteor/check'

import { ExpectedMediaItem, ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'

import { Mongo } from 'meteor/mongo'

export namespace ExpectedMediaItemsSecurity {
	export function allowReadAccess (selector: Mongo.Query<ExpectedMediaItem> | any, token: string, context: any) {
		check(selector, Object)
		check(selector.mediaFlowId, Object)
		check(selector.mediaFlowId.$in, Array)

		// let mediaFlowIds: string[] = selector.mediaFlowId.$in

		let mediaManagerDevice = PeripheralDevices.findOne({
			type: PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,
			token: token
		})

		if (!mediaManagerDevice) return false

		if (mediaManagerDevice && token) {

			// mediaManagerDevice.settings

			return mediaManagerDevice
		} else {

			// TODO: implement access logic here
			// use context.userId

			// just returning true for now
			return true
		}
	}
	export function allowWriteAccess () {
		// TODO
	}
}
// Setup rules:

ExpectedMediaItems.allow({
	insert (userId: string, doc: ExpectedMediaItem): boolean {
		return false
	},

	update (userId, doc, fields, modifier) {
		return false
	},

	remove (userId, doc) {
		return false
	}
})
