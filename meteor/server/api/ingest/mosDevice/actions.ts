import * as MOS from 'mos-connection'
import { logger } from '../../../logging'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice, PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { handleMosRundownData } from './ingest'
import { Piece } from '../../../../lib/collections/Pieces'
import { IngestPart } from 'tv-automation-sofie-blueprints-integration'
import { parseMosString } from './lib'
import { IngestActions } from '../actions'
import { WrapAsyncCallback } from '../../../../lib/lib'
import * as _ from 'underscore'
import { UserActionAPI } from '../../../../lib/api/userActions'

export namespace MOSDeviceActions {
	export const reloadRundown: (peripheralDevice: PeripheralDevice, rundown: Rundown) => UserActionAPI.ReloadRundownResponse = Meteor.wrapAsync(
		function reloadRundown (peripheralDevice: PeripheralDevice, rundown: Rundown, cb: WrapAsyncCallback<UserActionAPI.ReloadRundownResponse>): void {
			logger.info('reloadRundown ' + rundown._id)

			PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err: Error, mosRunningOrder: MOS.IMOSRunningOrder) => {
				if (err) {
					if (_.isString(err) && err.match(/rundown does not exist/i)) {
						// Don't throw an error, instead return MISSING value
						cb(null, UserActionAPI.ReloadRundownResponse.MISSING)
					} else {
						logger.error(err)
						cb(err)
					}
				} else {
					try {
						logger.info('triggerGetRunningOrder reply ' + mosRunningOrder.ID)
						logger.debug(mosRunningOrder)

						if (parseMosString(mosRunningOrder.ID) !== rundown.externalId) {
							throw new Meteor.Error(401, `Expected triggerGetRunningOrder reply for ${rundown.externalId} but got ${parseMosString(mosRunningOrder.ID)}`)
						}

						handleMosRundownData(peripheralDevice, mosRunningOrder, false)

						// Since the Reload reply is asynchronously followed by ROFullStories, the reload is technically not completed at this point
						cb(null, UserActionAPI.ReloadRundownResponse.WORKING)
					} catch (e) {
						cb(e)
					}
				}
			}, 'triggerGetRunningOrder', rundown.externalId)
		}
	)
	export function notifyCurrentPlayingPart (
		peripheralDevice: PeripheralDevice,
		rundown: Rundown,
		oldPlayingPartExternalId: string | null,
		newPlayingPartExternalId: string | null
	) {

		if (oldPlayingPartExternalId) {
			setStoryStatus(peripheralDevice._id, rundown, oldPlayingPartExternalId, MOS.IMOSObjectStatus.STOP)
			.catch(e => logger.error(e))
		}
		if (newPlayingPartExternalId) {
			setStoryStatus(peripheralDevice._id, rundown, newPlayingPartExternalId, MOS.IMOSObjectStatus.PLAY)
			.catch(e => logger.error(e))
		}
	}
	function setStoryStatus (deviceId: string, rundown: Rundown, storyId: string, status: MOS.IMOSObjectStatus): Promise<any> {
		return new Promise((resolve, reject) => {
			logger.debug('setStoryStatus', deviceId, rundown.externalId, storyId, status)
			PeripheralDeviceAPI.executeFunction(deviceId, (err, result) => {
				logger.debug('reply', err, result)
				if (err) {
					reject(err)
				} else {
					resolve(result)
				}
			}, 'setStoryStatus', rundown.externalId, storyId, status)
		})
	}

	export function setPieceInOutPoint (rundown: Rundown, piece: Piece, partCache: IngestPart, inPoint: number, duration: number) {
		return new Promise((resolve, reject) => {
			if (!partCache.payload) throw new Meteor.Error(500, `Part Cache for "${partCache.externalId}" missing payload!`)
			const mosPayload = partCache.payload as MOS.IMOSROFullStory
			if (!mosPayload.Body) throw new Meteor.Error(500, `Part Cache for "${partCache.externalId}" missing FullStory content!`)

			const story = mosPayload.Body.filter(item => item.Type === 'storyItem' && item.Content.ID === piece.externalId)[0].Content
			const timeBase = story.TimeBase || 1
			story.EditorialStart = inPoint * timeBase
			story.EditorialDuration = duration * timeBase
			story.TimeBase = timeBase

			const peripheralDevice = PeripheralDevices.findOne(rundown.peripheralDeviceId)
			if (!peripheralDevice) throw new Meteor.Error(404, 'PeripheralDevice "' + rundown.peripheralDeviceId + '" not found')

			PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err?: any) => {
				if (err) reject(err)
				else resolve()
			}, 'replaceStoryItem', mosPayload.RunningOrderId, mosPayload.ID, story)
		})
	}
}
