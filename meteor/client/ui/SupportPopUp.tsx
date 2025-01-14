import * as React from 'react'
import * as ClassNames from 'classnames'
import { withTracker } from '../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { CoreSystem } from '../../lib/collections/CoreSystem'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as faQuestion from '@fortawesome/fontawesome-free-solid/faQuestion'

interface IProps {

}

interface ITrackedProps {
	support: {
		message: string
	},
	systemInfo: {
		message: string,
		enabled: boolean
	}
}

export const SupportPopUp = withTracker<IProps, {}, ITrackedProps>((props: IProps) => {
	const core = CoreSystem.findOne()
	return {
		support: (core && core.support) ? core.support : { message: '' },
		systemInfo: (core && core.systemInfo) ? core.systemInfo : { message: '', enabled: false }
	}
})(class SupportPopUp extends MeteorReactComponent<IProps & ITrackedProps> {
	constructor (props: IProps) {
		super(props)
	}

	// componentDidMount () {}

	render () {
		return (
			<div className='support-pop-up-panel'>
				<div dangerouslySetInnerHTML={this.props.support.message ? { __html: this.props.support.message } : undefined} />
				{this.props.children && <div className='support-pop-up-panel__actions'>
					{this.props.children}
				</div>}
			</div>
		)
	}
})

interface IToggleProps {
	isOpen?: boolean
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export class SupportPopUpToggle extends React.PureComponent<IToggleProps> {
	render () {
		return <React.Fragment>
			<button className={ClassNames('status-bar__controls__button', 'support__toggle-button', {
				'status-bar__controls__button--open': this.props.isOpen,
			})} role='button' onClick={this.props.onClick} tabIndex={0}>
				<FontAwesomeIcon icon={faQuestion} />
			</button>
		</React.Fragment>
	}
}
