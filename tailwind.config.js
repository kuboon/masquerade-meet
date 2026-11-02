/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./app/**/*.{js,jsx,ts,tsx}'],
	theme: {
		extend: {
			// The landing page's palette, lifted from its illustration: a warm
			// paper background, navy ink, and the three mask colours.
			colors: {
				mm: {
					paper: '#FCF7EF',
					ink: '#1A1D45',
					coral: '#EE5A47',
					teal: '#1AA39A',
					sun: '#F2B12F',
					blue: '#2F5BD8',
				},
			},
			fontFamily: {
				landing: ['"Noto Sans JP"', 'system-ui', 'sans-serif'],
				logo: ['Outfit', '"Noto Sans JP"', 'system-ui', 'sans-serif'],
			},
			keyframes: {
				fadeIn: {
					from: {
						opacity: 0,
					},
					to: {
						opacity: 1,
					},
				},
				slideDownAndFade: {
					from: { opacity: 0, transform: 'translateY(-2px)' },
					to: { opacity: 1, transform: 'translateY(0)' },
				},
				slideLeftAndFade: {
					from: { opacity: 0, transform: 'translateX(2px)' },
					to: { opacity: 1, transform: 'translateX(0)' },
				},
				slideUpAndFade: {
					from: { opacity: 0, transform: 'translateY(2px)' },
					to: { opacity: 1, transform: 'translateY(0)' },
				},
				slideRightAndFade: {
					from: { opacity: 0, transform: 'translateX(2px)' },
					to: { opacity: 1, transform: 'translateX(0)' },
				},
			},
			animation: {
				fadeIn: 'fadeIn 0.5s ease 0.5s forwards',
				slideDownAndFade:
					'slideDownAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
				slideLeftAndFade:
					'slideLeftAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
				slideUpAndFade: 'slideUpAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
				slideRightAndFade:
					'slideRightAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
			},
		},
	},
	plugins: [],
}
