import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { MomentFromNow } from '../../lib/Moment'
import { doUserAction } from '../../lib/userAction'
import { UserActionsLogItem, UserActionsLog } from '../../../lib/collections/UserActionsLog'
import { Time, getCurrentTime } from '../../../lib/lib'
import * as moment from 'moment'
import { Meteor } from 'meteor/meteor'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { DatePickerFromTo } from '../../lib/datePicker'
import { UserActionsList } from '../Status/UserActivity'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { Snapshots, SnapshotType } from '../../../lib/collections/Snapshots'
import { Link } from 'react-router-dom'
import { UserActionAPI } from '../../../lib/api/userActions'

interface NextUserLogAction {
	message: UserActionsLogItem
	timeout: NodeJS.Timer | null
	targetTime: Time
}

interface IRecordingListProps {
	match?: {
		params?: {
			rundownId: string
		}
	}
}
interface IRecordingListState {
	dateFrom: Time
	dateTo: Time

	nextAction?: NextUserLogAction
}
interface IRecordingListTrackedProps {
	log: UserActionsLogItem[]
}

const UserLogPlayerPage = translateWithTracker<IRecordingListProps, IRecordingListState, IRecordingListTrackedProps>((props: IRecordingListProps) => {

	return {
		log: UserActionsLog.find({}, { sort: { timestamp: 1 } }).fetch()
	}
})(class extends MeteorReactComponent<Translated<IRecordingListProps & IRecordingListTrackedProps>, IRecordingListState> {
	private _currentsub: string = ''
	private _sub?: Meteor.SubscriptionHandle

	constructor (props: Translated<IRecordingListProps & IRecordingListTrackedProps>) {
		super(props)

		this.state = {
			dateFrom: moment().startOf('day').valueOf(),
			dateTo: moment().add(1, 'days').startOf('day').valueOf()
		}
	}
	componentWillMount () {
		// Subscribe to data:
		this.updateSubscription()
	}
	componentDidUpdate () {
		this.updateSubscription()
	}
	updateSubscription () {
		if (this.props.match && this.props.match.params) {
			let h = this.state.dateFrom + '_' + this.state.dateTo + '_' + this.props.match.params.rundownId
			if (h !== this._currentsub) {
				this._currentsub = h
				if (this._sub) {
					this._sub.stop()
				}
				this._sub = meteorSubscribe(PubSub.userActionsLog, {
					args: { $regex: `.*"${this.props.match.params.rundownId}".*` },
					timestamp: {
						$gte: this.state.dateFrom,
						$lt: this.state.dateTo,
					}
				})

			}
		}
	}
	componentWillUnmount () {
		if (this._sub) {
			this._sub.stop()
		}
		this._cleanUp()
	}

	stopExecution () {
		if (this.state.nextAction) {
			if (this.state.nextAction.timeout !== null) {
				clearTimeout(this.state.nextAction.timeout)
			}
			this.setState({
				nextAction: undefined
			})
		}
	}
	startExecution (msg: UserActionsLogItem) {
		if (this.state.nextAction && this.state.nextAction.timeout !== null) {
			clearTimeout(this.state.nextAction.timeout)
		}

		const action: NextUserLogAction = {
			message: msg,
			targetTime: getCurrentTime(),
			timeout: null
		}
		this.executeAndProgress(action)
	}
	executeAndProgress (action: NextUserLogAction) {
		this.executeSingle('UserActionLogPlayer', action.message)

		// find next
		const { log } = this.props
		const currentIndex = log.findIndex(l => l._id === action.message._id)
		const nextItem = log[currentIndex + 1]
		if (currentIndex === -1 || !nextItem) {
			this.setState({
				nextAction: undefined
			})
		} else {
			const targetTimeDiff = nextItem.timestamp - action.message.timestamp
			const targetTime = action.targetTime + targetTimeDiff

			const nextAction = {
				message: nextItem,
				timeout: setTimeout(() => this.executeAndProgress(nextAction), targetTime - getCurrentTime()),
				targetTime: targetTime
			}
			this.setState({ nextAction })
		}
	}
	executeSingle (e, msg: UserActionsLogItem) {
		const { t } = this.props

		const method = msg.method as UserActionAPI.methods
		const args = JSON.parse(msg.args)

		// Modify any parameters here
		switch (msg.method) {
			case UserActionAPI.methods.activate:
			case UserActionAPI.methods.resetAndActivate:
				// Always run in rehearsal mode
				args[1] = true
				break
		}

		doUserAction(t, e, method, args)
	}

	renderButtons (msg: UserActionsLogItem) {
		return <p>
			<button className='action-btn mod mhm' onClick={() => this.startExecution(msg)}>
				Play from here
			</button>
			<button className='action-btn mod mhm' onClick={(e) => this.executeSingle(e, msg)}>
				Exectute Single
			</button>
		</p>
	}

	renderControlPanel () {
		const { t } = this.props

		const { nextAction } = this.state
		if (!nextAction) {
			return <React.Fragment>
				<p>Status: Pending</p>
			</React.Fragment>
		} else {
			return <React.Fragment>
				<p>Status: Active</p>
				<p>Next Action: {`${nextAction.message.method} ${nextAction.message.args}`}</p>
				<p>Run in: <MomentFromNow>{nextAction.targetTime}</MomentFromNow></p>
				<p><button onClick={() => this.stopExecution()}>{t('Stop')}</button></p>
			</React.Fragment>
		}
	}

	renderDatePicker () {
		if (this.state.nextAction) {
			// Don't show the picker while it is running
			return <React.Fragment></React.Fragment>
		} else {
			return <DatePickerFromTo from={this.state.dateFrom} to={this.state.dateTo} onChange={this.handleChangeRangeDate} />
		}
	}

	handleChangeRangeDate = (from: Time, to: Time) => {
		this.setState({
			dateFrom: from,
			dateTo: to
		})
	}

	render () {
		const { t } = this.props

		return (
			<div className='mtl gutter'>
				<header className='mvs'>
					<h1>{t('User Log Player')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderControlPanel()}
				</div>
				<div className='paging'>
					{this.renderDatePicker()}
				</div>
				<div className='mod mvl'>
					<UserActionsList items={this.props.log} renderButtons={this.renderButtons.bind(this)} />
				</div>
			</div>
		)
	}
})


interface IRundownSelectProps {
}
interface IRundownSelectState {
}
interface IRundownSelectTrackedProps {
	rundowns: { [id: string]: string }
}
const UserLogRundownSelect = translateWithTracker<IRundownSelectProps, IRundownSelectState, IRundownSelectTrackedProps>((props: IRundownSelectProps) => {
	const rundowns = Rundowns.find().fetch()
	const snapshots = Snapshots.find().fetch()

	const rundownMap: IRundownSelectTrackedProps['rundowns'] = {}
	_.each(rundowns, rundown => {
		rundownMap[rundown._id] = `${rundown.name} (${rundown._id})`
	})

	_.each(snapshots, snapshot => {
		if (snapshot.rundownId && !rundownMap[snapshot.rundownId]) {
			rundownMap[snapshot.rundownId] = `${snapshot.rundownId}`
		}
	})

	return {
		rundowns: rundownMap
	}
})(class RundownSelection extends MeteorReactComponent<Translated<IRundownSelectProps & IRundownSelectTrackedProps>, IRundownSelectState> {
	componentWillMount () {
		// Subscribe to data:

		this.subscribe('rundowns', {})
		this.subscribe('snapshots', {
			type: SnapshotType.RUNDOWN
		})
	}
	render () {
		const { t } = this.props

		return (
			<div className='mhl gutter recordings-studio-select'>
				<header className='mbs'>
					<h1>{t('User Log Player')}</h1>
				</header>
				<div className='mod mvl'>
					<strong>Rundown</strong>
					<ul>
						{
							_.map(this.props.rundowns, (name, id) => {
								return (
									<li key={id}>
										<Link to={`userlogplayer/${id}`}>{name}</Link>
									</li>
								)
							})
						}
					</ul>
				</div>
			</div>
		)
	}
})

export { UserLogPlayerPage, UserLogRundownSelect }
