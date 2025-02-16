import * as mousetrap from 'mousetrap'
import * as _ from 'underscore'
import { isEventInInputField } from './lib'
import { isModalShowing } from './ModalDialog'

export namespace mousetrapHelper {
	const _boundHotkeys: {
		[key: string]: ((e: Event) => void)[]
	} = {}
	const _callbackTags: {
		[key: string]: (e: Event) => void
	} = {}

	function handleKey (keys: string, e: ExtendedKeyboardEvent) {
		if (_boundHotkeys[keys] === undefined) {
			return
		}
		// console.log(`Handling key combo "${keys}"`)
		_boundHotkeys[keys].forEach((i) => {
			i(e)
		})
	}

	export function bindGlobal (keys: string, callback: (e: Event) => void, action?: string, tag?: string, allowInModal?: boolean) {
		let index = keys
		if (action) index = keys + '_' + action
		if (_boundHotkeys[index] === undefined) {
			_boundHotkeys[index] = []
			mousetrap.bindGlobal(keys, (e: ExtendedKeyboardEvent) => {
				handleKey(index, e)
			}, action)
		}
		// console.log(`Registering callback for key combo "${keys}"`)

		const callbackWrap = (e: Event) => {
			if (isEventInInputField(e)) return
			e.preventDefault()
			if (!allowInModal && isModalShowing()) return

			callback(e)
		}
		_boundHotkeys[index].push(callbackWrap)

		if (tag) {
			if (_callbackTags[index + '_' + tag]) {
				throw new Error(`Globalbind: Callback with tag "${tag}" already exists for ${index}!`)
			}
			_callbackTags[index + '_' + tag] = callbackWrap
		}
	}

	export function bind (keys: string, callback: (e: Event) => void, action?: string, tag?: string, allowInModal?: boolean) {
		let index = keys
		if (action) index = keys + '_' + action
		if (_boundHotkeys[index] === undefined) {
			_boundHotkeys[index] = []
			mousetrap.bind(keys, (e: ExtendedKeyboardEvent) => {
				handleKey(index, e)
			}, action)
		}
		// console.log(`Registering callback for key combo "${keys}"`)

		const callbackWrap = (e: Event) => {
			if (isEventInInputField(e)) return
			e.preventDefault()
			if (!allowInModal && isModalShowing()) return

			callback(e)
		}
		_boundHotkeys[index].push(callbackWrap)

		if (tag) {
			if (_callbackTags[index + '_' + tag]) {
				throw new Error(`Bind: Callback with tag "${tag}" already exists for ${index}!`)
			}
			_callbackTags[index + '_' + tag] = callbackWrap
		}
	}

	export function unbindAll (keys: string[], action?: string) {
		keys.forEach(key => {
			let index = key
			if (action) index = key + '_' + action
			if (_boundHotkeys[index] === undefined) return
			delete _boundHotkeys[index]
			mousetrap.unbind(keys, action)
		})
	}

	export function unbind (keys: string, callbackOrTag: ((e: Event) => void) | string, action?: string) {
		let index = keys
		if (action) index = keys + '_' + action

		let tag = typeof callbackOrTag === 'string' ? callbackOrTag : undefined
		let callback = typeof callbackOrTag === 'function' ? callbackOrTag : undefined

		if (tag) {
			callback = _callbackTags[index + '_' + tag]
			if (callback === undefined) {
				throw new Error(`No callback found for ${tag} and keys ${keys}`)
			}
		}

		if (_boundHotkeys[index] === undefined) return
		const callbackIndex = _boundHotkeys[index].findIndex(val => val === callback)
		if (callbackIndex >= 0) {
			_boundHotkeys[index].splice(callbackIndex, 1)
			if (tag) {
				// cleanup callback tags to avoid memory leaks
				delete _callbackTags[index + '_' + tag]
			}
		}
		if (_boundHotkeys[index].length === 0) {
			delete _boundHotkeys[index]
			mousetrap.unbind(keys, action)
		}
	}

	export function shortcutLabel (hotkey: string, isMacLike: boolean = false): string {
		if (isMacLike) {
			hotkey = hotkey.replace(/mod/i, '\u2318')
		} else {
			hotkey = hotkey.replace(/mod/i, 'Ctrl')
		}
		// capitalize first letter of each combo key
		hotkey = hotkey.replace(/(\w)\w*/ig, (substring: string) => {
			return substring.substr(0, 1).toUpperCase() + substring.substr(1).toLowerCase()
		}).replace(/(\s*,\s*)/g, (separator: string) => {
			return ', '
		})

		return hotkey
	}
}

// Add mousetrap keycodes for special keys
mousetrap.addKeycodes({
	220: '§', // on US-based (ANstudio) keyboards (single-row, Enter key), this is the key above Enter, usually with a backslash and the vertical pipe character
	222: '\\', // on ANstudio-based keyboards, this is the key with single quote
	223: '|', // this key is not present on ANstudio-based keyboards

	96: 'num0',
	97: 'num1',
	98: 'num2',
	99: 'num3',
	100: 'num4',
	101: 'num5',
	102: 'num6',
	103: 'num7',
	104: 'num8',
	105: 'num9',
	106: 'numMul',
	107: 'numAdd',
	109: 'numSub',
	110: 'numDot',
	111: 'numDiv'
})
