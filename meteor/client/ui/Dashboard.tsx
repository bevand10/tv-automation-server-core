import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import { Translated } from '../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'

import { statusCodeToString } from './Status/SystemStatus'
import { NotificationCenter, Notification, NoticeLevel } from '../lib/notifications/notifications'

const PackageInfo = require('../../package.json')

interface IState {
	systemStatus?: number
}
interface IProps {

}
export default translate()(class Dashboard extends React.Component<Translated<IProps>, IState> {
	constructor (props) {
		super(props)

		this.state = {}
	}

	componentDidMount () {
		const { t } = this.props

		Meteor.call('systemStatus.getSystemStatus', (err: any, res: any) => {
			if (err) {
				// console.error(err)
				NotificationCenter.push(new Notification('systemStatus_failed', NoticeLevel.CRITICAL, t('Could not get system status. Please consult system administrator.'), 'Dashboard'))
				return
			}

			this.setState({
				systemStatus: res.statusCode
			})
		})
	}

	render () {
		const { t } = this.props

		return (
			<div>
				<div className='mtl gutter'>
					<h1>{t('Welcome to the Sofie Automation system')}</h1>
				</div>
				<div className='mtl gutter version-info'>
					<p>{t('Sofie Automation version')}: {PackageInfo.version || 'UNSTABLE'}, {t('Sofie status')}: {statusCodeToString(t, this.state.systemStatus || 0)}</p>
				</div>
			</div>
		)
	}
})
