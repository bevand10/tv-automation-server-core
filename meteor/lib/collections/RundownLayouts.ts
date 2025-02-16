import { Mongo } from 'meteor/mongo'
import { Meteor } from 'meteor/meteor'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration'

/**
 * The view targeted by this layout:
 * RUNDOWN_LAYOUT: a Rundown view for highly scripted shows: a show split into Segments and Parts,
 * 				   accurate timing on each of those with over/under etc.
 * DASHBOARD_LAYOUT: a Dashboard view for AdLib shows (low-scripted): a list of buttons and some generic show layout
 *
 * @export
 * @enum {string}
 */
export enum RundownLayoutType {
	RUNDOWN_LAYOUT = 'rundown_layout',
	DASHBOARD_LAYOUT = 'dashboard_layout'
}

/**
 * Display style to be used by this filter
 *
 * @export
 * @enum {string}
 */
export enum PieceDisplayStyle {
	LIST = 'list',
	BUTTONS = 'buttons'
}

/**
 * A filter to be applied against the AdLib Pieces. If a member is undefined, the pool is not tested
 * against that filter. A member must match all of the sub-filters to be included in a filter view
 *
 * @export
 * @interface RundownLayoutFilter
 */
export interface RundownLayoutFilterBase {
	_id: string
	name: string
	rank: number
	sourceLayerIds: string[] | undefined
	sourceLayerTypes: SourceLayerType[] | undefined
	outputLayerIds: string[] | undefined
	label: string[] | undefined
	tags: string[] | undefined
	displayStyle: PieceDisplayStyle
	currentSegment: boolean
	/**
	 * true: include Rundown Baseline AdLib Pieces
	 * false: do not include Rundown Baseline AdLib Pieces
	 * 'only': show only Rundown Baseline AdLib Pieces matching this filter
	 */
	rundownBaseline: boolean | 'only'
}

export interface RundownLayoutFilter extends RundownLayoutFilterBase {
	default: boolean
}

export interface DashboardLayoutFilter extends RundownLayoutFilterBase {
	x: number
	y: number
	width: number
	height: number
}

export interface RundownLayoutBase {
	_id: string
	showStyleBaseId: string
	blueprintId?: string
	userId?: string
	name: string
	type: RundownLayoutType
	filters: RundownLayoutFilterBase[]
}

export interface RundownLayout extends RundownLayoutBase {
	type: RundownLayoutType.RUNDOWN_LAYOUT
	filters: RundownLayoutFilter[]
}

export enum ActionButtonType {
	TAKE = 'take',
	HOLD = 'hold',
	MOVE_NEXT_PART = 'move_next_part',
	MOVE_NEXT_SEGMENT = 'move_next_segment',
	MOVE_PREVIOUS_PART = 'move_previous_part',
	MOVE_PREVIOUS_SEGMENT = 'move_previous_segment',
	ACTIVATE = 'activate',
	ACTIVATE_REHEARSAL = 'activate_rehearsal',
	DEACTIVATE = 'deactivate',
	RESET_RUNDOWN = 'reset_rundown',
	QUEUE_ADLIB = 'queue_adlib' // The idea for it is that you would be able to press and hold this button
								// and then click on whatever adlib you would like
}

export interface DashboardLayoutActionButton {
	type: ActionButtonType
	x: number
	y: number
	width: number
	height: number
}

export interface DashboardLayout extends RundownLayoutBase {
	// TODO: Interface to be defined later
	type: RundownLayoutType.DASHBOARD_LAYOUT
	filters: DashboardLayoutFilter[]
	actionButtons: DashboardLayoutActionButton[]
}

export const RundownLayouts: TransformedCollection<RundownLayoutBase, RundownLayoutBase>
	= new Mongo.Collection<RundownLayoutBase>('rundownLayouts')
registerCollection('RundownLayouts', RundownLayouts)
Meteor.startup(() => {
	if (Meteor.isServer) {
		// RundownLayouts._ensureIndex({
		// 	studioId: 1,
		// 	collectionId: 1,
		// 	objId: 1,
		// 	mediaId: 1
		// })
		RundownLayouts._ensureIndex({
			showStyleBaseId: 1
		})
	}
})
