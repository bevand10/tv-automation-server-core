import { Meteor } from 'meteor/meteor'
import { SegmentLine } from '../../lib/collections/SegmentLines'
import { RunningOrder } from '../../lib/collections/RunningOrders'
import { ShowStyles, ShowStyle } from '../../lib/collections/ShowStyles'
import { logger } from '../logging'
import { loadBlueprints, getMessageContext } from './blueprints'
import { ExternalMessageQueue, ExternalMessageQueueObj } from '../../lib/collections/ExternalMessageQueue'
import { getCurrentTime, removeNullyProperties } from '../../lib/lib'
import { triggerdoMessageQueue } from './ExternalMessageQueue'
import * as _ from 'underscore'

export function triggerExternalMessage (
	runningOrder: RunningOrder,
	takeSegmentLine: SegmentLine,
	previousSegmentLine: SegmentLine | null
) {
	// console.log('triggerExternalMessage')
	logger.debug('triggerExternalMessage')
	try {
		let showStyle: ShowStyle | undefined = ShowStyles.findOne(runningOrder.showStyleId)
		if (!showStyle) throw new Meteor.Error(404, 'ShowStyle "' + runningOrder.showStyleId + '" not found!')

		const innerContext = getMessageContext(runningOrder)
		try {
			const blueprints = loadBlueprints(showStyle)

			let resultMessages: Array<ExternalMessageQueueObj> | null = blueprints.Message(innerContext, runningOrder, takeSegmentLine, previousSegmentLine)

			if (resultMessages === null) {
				// do nothing
			} else if (_.isObject(resultMessages) && _.isEmpty(resultMessages)) {
				// do nothing
			} else {

				_.each(resultMessages, (message) => {

					// check the output:
					if (!message) 			throw new Meteor.Error('Falsy result!')
					if (!message.type) 		throw new Meteor.Error('attribute .type missing!')
					if (!message.receiver) 	throw new Meteor.Error('attribute .receiver missing!')
					if (!message.message) 	throw new Meteor.Error('attribute .message missing!')

					// Save the output into the message queue, for later processing:
					let now = getCurrentTime()
					message.created = now
					message.studioId = runningOrder.studioInstallationId
					message.tryCount = 0
					if (!message.expires) message.expires = now + 35 * 24 * 3600 * 1000 // 35 days

					message = removeNullyProperties(message)

					// console.log('result', result)

					if (!runningOrder.rehearsal) { // Don't save the message when running rehearsals
						ExternalMessageQueue.insert(message)

						triggerdoMessageQueue() // trigger processing of the queue
					}
				})

			}
		} catch (e) {
			let str = e.toString() + ' ' + (e.stack || '')
			throw new Meteor.Error(402, 'Error executing blueprint message helper: ' + str )
		}
	} catch (e) {
		logger.error(e)
	}
}
