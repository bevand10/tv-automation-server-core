import { Meteor } from 'meteor/meteor'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { ShowStyle, ShowStyles } from '../../lib/collections/ShowStyles'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { getCurrentTime, saveIntoDb, literal, DBObj, partialExceptId } from '../../lib/lib'
import { RundownAPI } from '../../lib/api/rundown'
import { TimelineTransition } from '../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../lib/constants/casparcg'
import { Segment, Segments } from '../../lib/collections/Segments'
import { PeripheralDevices, PlayoutDeviceType } from '../../lib/collections/PeripheralDevices'
import { Random } from 'meteor/random'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

// Imports from TSR (TODO make into an import)
export interface Mappings {
	[layerName: string]: Mapping
}
export interface Mapping {
	device: DeviceType,
	deviceId: string,
	channel?: number,
	layer?: number
	// [key: string]: any
}
export interface MappingCasparCG extends Mapping {
	device: DeviceType.CASPARCG,
	channel: number,
	layer: number
}
export interface MappingAbstract extends Mapping {
	device: DeviceType.ABSTRACT,
	abstractPipe: number
}
export interface MappingAtem extends Mapping {
	mappingType: MappingAtemType
	index?: number
}
export interface MappingLawo extends Mapping {
	device: DeviceType.LAWO,
	channel: number
}
export enum MappingAtemType {
	MixEffect,
	DownStreamKeyer,
	SuperSourceBox,
	Auxilliary,
	MediaPlayer
}
export enum DeviceType {
	ABSTRACT = 0,
	CASPARCG = 1,
	ATEM = 2,
	LAWO = 3,
	HTTPSEND = 4
}
// const literal = <T>(o: T) => o

Meteor.methods({
	'initDB': () => {
		console.log('initDB')
		// Initiate database:
		StudioInstallations.upsert('studio0', {$set: {
			name: 'Dummy studio',
			outputLayers: [],
		}})

		// Create outputLayers:
		StudioInstallations.update('studio0', {$set: {
			outputLayers: [
				{
					_id: 'pgm0',
					name: 'PGM',
					isPGM: true,
				},
				{
					_id: 'monitor0',
					name: 'Skjerm',
					isPGM: false,
				}
			],
		}})
		// Create sourceLayers:
		StudioInstallations.update('studio0', {$set: {
			sourceLayers: [
				{
					_id: 'studio0_vignett',
					_rank: 40,
					name: 'Vignett',
					type: RundownAPI.SourceLayerType.VT,
					onPGMClean: true
				},
				{
					_id: 'studio0_live_speak0',
					_rank: 50,
					name: 'STK',
					type: RundownAPI.SourceLayerType.LIVE_SPEAK,
					onPGMClean: true
				},
				{
					_id: 'studio0_graphics0',
					_rank: 100,
					name: 'Suprer',
					type: RundownAPI.SourceLayerType.GRAPHICS,
					onPGMClean: false
				},
				// {
				// 	_id: 'studio0_lower_third0',
				// 	_rank: 10,
				// 	name: 'Super',
				// 	type: RundownAPI.SourceLayerType.LOWER_THIRD,
				// 	onPGMClean: false
				// },
				// {
				// 	_id: 'studio0_split0',
				// 	_rank: 15,
				// 	name: 'Split',
				// 	type: RundownAPI.SourceLayerType.SPLITS,
				// 	onPGMClean: true,
				// },
				// {
				// {
				// 	_id: 'studio0_remote0',
				// 	_rank: 60,
				// 	name: 'RM1',
				// 	type: RundownAPI.SourceLayerType.REMOTE,
				// 	onPGMClean: true,
				// 	isRemoteInput: true
				// },
				// {
				// 	_id: 'studio0_vt0',
				// 	_rank: 80,
				// 	name: 'VB',
				// 	type: RundownAPI.SourceLayerType.VT,
				// 	onPGMClean: true,
				// },
				// {
				// 	_id: 'studio0_mic0',
				// 	_rank: 90,
				// 	name: 'Mic',
				// 	type: RundownAPI.SourceLayerType.MIC,
				// 	onPGMClean: true,
				// },
				// {
				// 	_id: 'studio0_camera0',
				// 	_rank: 100,
				// 	name: 'Kam',
				// 	type: RundownAPI.SourceLayerType.CAMERA,
				// 	onPGMClean: true,
				// },
			],
		}})
		// Create Timeline mappings:
		const mappings: Mappings = { // Logical layers and their mappings
			'casparcg_player_vignett': literal<MappingCasparCG>({
				device: DeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 5,
				layer: 140
			}),
			'casparcg_player_soundeffect': literal<MappingCasparCG>({
				device: DeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 5,
				layer: 130
			}),
			'casparcg_player_clip': literal<MappingCasparCG>({
				device: DeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 1,
				layer: 110
			}),
			'casparcg_cg_graphics': literal<MappingCasparCG>({
				device: DeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 4,
				layer: 120
			}),
			'casparcg_cg_logo': literal<MappingCasparCG>({
				device: DeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 4,
				layer: 121
			}),
			'casparcg_cg_studiomonitor': literal<MappingCasparCG>({
				device: DeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 3,
				layer: 120
			}),
			'atem_me_program': literal<MappingAtem>({
				device: DeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.MixEffect,
				index: 0 // 0 = ME1
			}),
			'atem_me_studiomonitor': literal<MappingAtem>({
				device: DeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.MixEffect,
				index: 1 // 1 = ME2
			}),
			'atem_aux_clean': literal<MappingAtem>({
				device: DeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.Auxilliary,
				index: 1
			}),
			'atem_aux_preview': literal<MappingAtem>({
				device: DeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.Auxilliary,
				index: 2
			}),
			'atem_dsk_graphics': literal<MappingAtem>({
				device: DeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.DownStreamKeyer,
				index: 0 // 0 = DSK1
			}),
			'atem_dsk_effect': literal<MappingAtem>({
				device: DeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.DownStreamKeyer,
				index: 1 // 1 = DSK2
			}),
			'atem_supersource': literal<MappingAtem>({
				device: DeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.SuperSourceBox,
				index: 0 // 0 = SS
			}),
			'lawo_source_automix': literal<MappingLawo>({
				device: DeviceType.LAWO,
				deviceId: 'lawo0',
				channel: 1
			}),
			'lawo_source_clip': literal<MappingLawo>({
				device: DeviceType.LAWO,
				deviceId: 'lawo0',
				channel: 2
			}),
			'lawo_source_effect': literal<MappingLawo>({
				device: DeviceType.LAWO,
				deviceId: 'lawo0',
				channel: 3
			}),
			'lawo_source_preview': literal<MappingLawo>({
				device: DeviceType.LAWO,
				deviceId: 'lawo0',
				channel: 4
			})
		}
		PeripheralDevices.find({
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT
		}).forEach((pd) => {
			PeripheralDevices.update(pd._id, {$set: {
				'settings.devices.casparcg0': ((pd['settings'] || {})['devices'] || {})['casparcg0'] || {
					type: PlayoutDeviceType.CASPARCG,
					options: {
						host: '127.0.0.1',
						port: 5250
					}
				},
				'settings.devices.atem0': ((pd['settings'] || {})['devices'] || {})['atem0'] || {
					type: PlayoutDeviceType.ATEM,
					options: {
						host: '192.168.1.101',
						port: 9910
					}
				},
				'settings.devices.lawo0': ((pd['settings'] || {})['devices'] || {})['lawo0'] || {
					type: PlayoutDeviceType.LAWO,
					options: {
						host: '127.0.0.1',
						port: 9000
					}
				}
			}})
			PeripheralDevices.update(pd._id, {$set: {
				mappings: mappings
			}})
		})
	}
})