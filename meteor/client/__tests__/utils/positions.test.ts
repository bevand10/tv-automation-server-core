import { getElementDocumentOffset } from '../../utils/positions'

describe('getElementDocumentOffset', () => {
	const emptyRect: ClientRect = {
		top: 0,
		left: 0,
		bottom: 0,
		right: 0,
		height: 0,
		width: 0
	}

	test('should return null for null input', () => {
		const actual = getElementDocumentOffset(null)

		expect(actual).toBe(null)
	})


	describe('{top}', () => {
		test('should be 0 when bounding client rect top is 0 and window.scrollY is 0', () => {
			Object.defineProperty(window, 'scrollY', { value: 0 })
			const container = document.createElement('div');
			container.getBoundingClientRect = (): ClientRect => {
				return Object.assign({}, emptyRect, { top: 0 })
			}

			const actual = getElementDocumentOffset(container)

			expect(actual).toHaveProperty('top', 0)
		})

		test('should be 20 when bounding client rect top is 20 and window.scrollY is 0', () => {
			Object.defineProperty(window, 'scrollY', { value: 0 })
			const container = document.createElement('div');
			container.getBoundingClientRect = (): ClientRect => {
				return Object.assign({}, emptyRect, { top: 20 })
			}

			const actual = getElementDocumentOffset(container)

			expect(actual).toHaveProperty('top', 20)
		})

		test('should be 31 when bounding client rect top is 10 and window.scrollY is 21', () => {
			Object.defineProperty(window, 'scrollY', { value: 21 })
			const container = document.createElement('div');
			container.getBoundingClientRect = (): ClientRect => {
				return Object.assign({}, emptyRect, { top: 10 })
			}

			const actual = getElementDocumentOffset(container)

			expect(actual).toHaveProperty('top', 31)
		})
	})

	describe('{left}', () => {
		test('should be 0 when bounding client rect left is 0 and window.scrollX is 0', () => {
			Object.defineProperty(window, 'scrollY', { value: 0 })
			const container = document.createElement('div');
			container.getBoundingClientRect = (): ClientRect => {
				return Object.assign({}, emptyRect, { left: 0 })
			}

			const actual = getElementDocumentOffset(container)

			expect(actual).toHaveProperty('left', 0)
		})

		test('should be 18 when bounding client rect left is 18 and window.scrollX is 0', () => {
			Object.defineProperty(window, 'scrollX', { value: 0 })
			const container = document.createElement('div');
			container.getBoundingClientRect = (): ClientRect => {
				return Object.assign({}, emptyRect, { left: 18 })
			}

			const actual = getElementDocumentOffset(container)

			expect(actual).toHaveProperty('left', 18)
		})

		test('should be 42 when bounding client rect left is 2 and window.scrollX is 40', () => {
			Object.defineProperty(window, 'scrollX', { value: 40 })
			const container = document.createElement('div');
			container.getBoundingClientRect = (): ClientRect => {
				return Object.assign({}, emptyRect, { left: 2 })
			}

			const actual = getElementDocumentOffset(container)

			expect(actual).toHaveProperty('left', 42)
		})
	})
})
