import { Meteor } from 'meteor/meteor'
import * as MOS from 'mos-connection'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../../../lib/api/peripheralDevice'
import { setupDefaultStudioEnvironment } from '../../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../../lib/collections/Rundowns'
import { testInFiber } from '../../../../../__mocks__/helpers/jest'
import { Parts } from '../../../../../lib/collections/Parts'
import { PeripheralDevice } from '../../../../../lib/collections/PeripheralDevices'
import { MOSDeviceActions } from '../actions'
import {
	PeripheralDeviceCommands, PeripheralDeviceCommand
} from '../../../../../lib/collections/PeripheralDeviceCommands'
import { IngestDataCache, IngestCacheType } from '../../../../../lib/collections/IngestDataCache'

import { mockRO } from './mock-mos-data'

require('../api.ts') // include in order to create the Meteor methods needed

describe('Test sending mos actions', () => { // TODO - these tests are strangely slow

	let device: PeripheralDevice
	let observer: Meteor.LiveQueryHandle | null = null
	beforeAll(() => {
		device = setupDefaultStudioEnvironment().device
	})
	afterEach(() => {
		if (observer != null) {
			observer.stop()
			observer = null
		}
	})

	testInFiber('reloadRundown: expect error', () => {
		// setLoggerLevel('debug')
		// Ensure there is a rundown to start with
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, mockRO.roCreate())

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		// Listen for changes
		observer = PeripheralDeviceCommands.find({ deviceId: device._id }).observeChanges({
			added: (id: string) => {
				const cmd = PeripheralDeviceCommands.findOne(id) as PeripheralDeviceCommand
				expect(cmd).toBeTruthy()
				expect(cmd.functionName).toEqual('triggerGetRunningOrder')
				expect(cmd.args).toEqual([rundown.externalId])

				PeripheralDeviceCommands.update(cmd._id, { $set: {
					replyError: 'unknown annoying error',
					hasReply: true,
				}})
			}
		})

		try {
			MOSDeviceActions.reloadRundown(device, rundown)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e).toBe(`unknown annoying error`)
		}
	})

	testInFiber('reloadRundown: valid payload', () => {
		// setLoggerLevel('debug')
		// Ensure there is a rundown to start with
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, mockRO.roCreate())

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		// Listen for changes
		observer = PeripheralDeviceCommands.find({ deviceId: device._id }).observeChanges({
			added: (id: string) => {
				const cmd = PeripheralDeviceCommands.findOne(id) as PeripheralDeviceCommand
				expect(cmd).toBeTruthy()
				expect(cmd.functionName).toEqual('triggerGetRunningOrder')
				expect(cmd.args).toEqual([rundown.externalId])

				const roData = mockRO.roCreate()
				roData.Slug = new MOS.MosString128('new name')

				PeripheralDeviceCommands.update(cmd._id, { $set: {
					reply: roData,
					hasReply: true,
				}})
			}
		})

		// Load in some part payloads to verify they will get used when the reload gets handled
		const cache1 = IngestDataCache.find({
			rundownId: rundown._id,
			// segmentId: { $exists: true },
			// partId: { $exists: true },
			type: IngestCacheType.PART
		}).fetch()
		_.each(cache1, cache => {
			IngestDataCache.update(cache._id, { $set: {
				'data.payload': `payload_for_${cache.partId}`
			}})
		})

		MOSDeviceActions.reloadRundown(device, rundown)

		// Verify metadata was set as ingest payload
		const parts = Parts.find({ rundownId: rundown._id }).fetch()
		_.each(parts, part => {
			expect(part.metaData).toEqual(`payload_for_${part._id}`)
		})
	})

	testInFiber('reloadRundown: receive incorrect response rundown id', () => {
		// setLoggerLevel('debug')
		// Ensure there is a rundown to start with
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, mockRO.roCreate())

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		// Listen for changes
		observer = PeripheralDeviceCommands.find({ deviceId: device._id }).observeChanges({
			added: (id: string) => {
				const cmd = PeripheralDeviceCommands.findOne(id) as PeripheralDeviceCommand
				expect(cmd).toBeTruthy()
				expect(cmd.functionName).toEqual('triggerGetRunningOrder')
				expect(cmd.args).toEqual([rundown.externalId])

				const roData = mockRO.roCreate()
				roData.ID = new MOS.MosString128('newId')

				PeripheralDeviceCommands.update(cmd._id, { $set: {
					reply: roData,
					hasReply: true,
				}})
			}
		})

		try {
			MOSDeviceActions.reloadRundown(device, rundown)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[401] Expected triggerGetRunningOrder reply for SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-aaaaa but got newId`)
		}
	})

})
