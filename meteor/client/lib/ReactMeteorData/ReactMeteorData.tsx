/* global Package */
/* eslint-disable react/prefer-stateless-function */

import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { Tracker } from 'meteor/tracker'
import { translate, InjectedTranslateProps } from 'react-i18next'
import { MeteorReactComponent } from '../MeteorReactComponent'
import * as _ from 'underscore'

// A class to keep the state and utility methods needed to manage
// the Meteor data for a component.
class MeteorDataManager {
	component: any
	computation: any
	oldData: any

	constructor (component) {
		this.component = component
		this.computation = null
		this.oldData = null
	}

	dispose () {
		if (this.computation) {
			this.computation.stop()
			this.computation = null
		}
	}

	calculateData () {
		const component = this.component

		if (!component.getMeteorData) {
			return null
		}

		// When rendering on the server, we don't want to use the Tracker.
		// We only do the first rendering on the server so we can get the data right away
		if (Meteor.isServer) {
			return component.getMeteorData()
		}

		if (this.computation) {
			this.computation.stop()
			this.computation = null
		}

		let data
		// Use Tracker.nonreactive in case we are inside a Tracker Computation.
		// This can happen if someone calls `ReactDOM.render` inside a Computation.
		// In that case, we want to opt out of the normal behavior of nested
		// Computations, where if the outer one is invalidated or stopped,
		// it stops the inner one.
		this.computation = Tracker.nonreactive(() => (
			Tracker.autorun((c) => {
				if (c.firstRun) {
					const savedSetState = component.setState
					try {
						component.setState = () => {
							throw new Error(
										'Can\'t call `setState` inside `getMeteorData` as this could '
										+ 'cause an endless loop. To respond to Meteor data changing, '
										+ 'consider making this component a \"wrapper component\" that '
										+ 'only fetches data and passes it in as props to a child '
										+ 'component. Then you can use `componentWillReceiveProps` in '
										+ 'that child component.')
						}

						data = component.getMeteorData()
					} finally {
						component.setState = savedSetState
					}
				} else {
							// Stop this computation instead of using the re-run.
							// We use a brand-new autorun for each call to getMeteorData
							// to capture dependencies on any reactive data sources that
							// are accessed.  The reason we can't use a single autorun
							// for the lifetime of the component is that Tracker only
							// re-runs autoruns at flush time, while we need to be able to
							// re-call getMeteorData synchronously whenever we want, e.g.
							// from componentWillUpdate.
					c.stop()
							// Calling forceUpdate() triggers componentWillUpdate which
							// recalculates getMeteorData() and re-renders the component.
					component.forceUpdate()
				}
			})
		))

		if (Mongo && data) {
			Object.keys(data).forEach((key) => {
				if (data[key] instanceof Mongo.Cursor) {
					console.warn(
						'Warning: you are returning a Mongo cursor from getMeteorData. '
						+ 'This value will not be reactive. You probably want to call '
						+ '`.fetch()` on the cursor before returning it.'
						)
				}
			})
		}

		return data
	}

	updateData (newData) {
		const component = this.component
		const oldData = this.oldData

		if (!(newData && (typeof newData) === 'object')) {
			throw new Error('Expected object returned from getMeteorData')
		}
		// update componentData in place based on newData
		for (let key in newData) {
			component.data[key] = newData[key]
		}
		// if there is oldData (which is every time this method is called
		// except the first), delete keys in newData that aren't in
		// oldData.  don't interfere with other keys, in case we are
		// co-existing with something else that writes to a component's
		// this.data.
		if (oldData) {
			for (let key in oldData) {
				if (!(key in newData)) {
					delete component.data[key]
				}
			}
		}
		this.oldData = newData
	}
}
export const ReactMeteorData = {
	componentWillMount () {
		this.data = {}
		this._meteorDataManager = new MeteorDataManager(this)
		const newData = this._meteorDataManager.calculateData()
		this._meteorDataManager.updateData(newData)
	},

	componentWillUpdate (nextProps, nextState) {
		const saveProps = this.props
		const saveState = this.state
		let newData
		try {
			// Temporarily assign this.state and this.props,
			// so that they are seen by getMeteorData!
			// This is a simulation of how the proposed Observe API
			// for React will work, which calls observe() after
			// componentWillUpdate and after props and state are
			// updated, but before render() is called.
			// See https://github.com/facebook/react/issues/3398.
			this.props = nextProps
			this.state = nextState
			newData = this._meteorDataManager.calculateData()
		} finally {
			this.props = saveProps
			this.state = saveState
		}

		this._meteorDataManager.updateData(newData)
	},

	componentWillUnmount () {
		this._meteorDataManager.dispose()
	},
	// pick the MeteorReactComponent member functions, so they will be available in withTracker(() => { >here< })
	autorun: MeteorReactComponent.prototype.autorun,
	subscribe: MeteorReactComponent.prototype.subscribe
}

class ReactMeteorComponentWrapper<P, S> extends React.Component<P, S> {
	data: any
	_renderedContent: any
}
Object.assign(ReactMeteorComponentWrapper.prototype, ReactMeteorData)
class ReactMeteorPureComponentWrapper<P, S> extends React.PureComponent<P, S> {}
Object.assign(ReactMeteorPureComponentWrapper.prototype, ReactMeteorData)

export interface WithTrackerOptions<IProps, IState, TrackedProps> {
	getMeteorData: (props: IProps) => TrackedProps
	shouldComponentUpdate?: (data: any, props: IProps, nextProps: IProps, state?: IState, nextState?: IState) => boolean
	// pure?: boolean
}
// @todo: add withTrackerPure()
type IWrappedComponent<IProps, IState, TrackedProps> = new (props: IProps & TrackedProps, state: IState) => MeteorReactComponent<IProps & TrackedProps, IState>
export function withTracker<IProps, IState, TrackedProps> (
	autorunFunction: (props: IProps) => TrackedProps,
	checkUpdate?: ((data: any, props: IProps, nextProps: IProps) => boolean) | ((data: any, props: IProps, nextProps: IProps, state: IState, nextState: IState) => boolean)
	):
	(WrappedComponent: IWrappedComponent<IProps, IState, TrackedProps>) =>
		new (props: IProps) => React.Component<IProps, IState> {

	let expandedOptions: WithTrackerOptions<IProps, IState, TrackedProps>

	expandedOptions = {
		getMeteorData: autorunFunction,
		shouldComponentUpdate: checkUpdate
	}

	return (WrappedComponent) => {
		// return ''
		return class extends ReactMeteorComponentWrapper<IProps, IState> {
			getMeteorData () {
				return expandedOptions.getMeteorData.call(this, this.props)
			}
			// This hook allows lower-level components to do smart optimization,
			// without running a potentially heavy recomputation of the getMeteorData.
			// This is potentially very dangerous, so use with caution.
			shouldComponentUpdate (nextProps: IProps, nextState: IState): boolean {
				if (typeof expandedOptions.shouldComponentUpdate === 'function') {
					return expandedOptions.shouldComponentUpdate(this.data, this.props, nextProps, this.state, nextState)
				}
				return true
			}
			render () {
				let content = <WrappedComponent {...this.props} {...this.data} />
				this._renderedContent = content
				return content
			}
		}
	}
}
export function translateWithTracker<IProps, IState, TrackedProps> (autorunFunction: (props: IProps, state?: IState) => TrackedProps) {
	return (WrappedComponent: IWrappedComponent<IProps, IState, TrackedProps>) => {
		return translate()(withTracker(autorunFunction)(WrappedComponent))
	}
}
export type Translated<T> = T & InjectedTranslateProps

// function withTracker<IProps, IState, TrackedProps>
// 	(
// 		autorunFunction: (props: IProps, state?: IState | undefined) => TrackedProps
// 	): (
// 		WrappedComponent: new (
// 			props: TrackedProps,
// 			state: IState
// 		) => React.Component<TrackedProps, IState, never>
// 	) => any
