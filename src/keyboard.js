const kb = require('./keyboardBtns')

module.exports = {
	home: [
		[kb.home.films, kb.home.cinemas],
		[kb.home.favorite]
	],
	film: [
		[kb.film.random],
		[kb.film.action, kb.film.comedy],
		[kb.back]
	],
	cinemas: [
		[
			{
				text: 'Отправить местоположение',
				request_location: true
			}
		],
		[kb.back]
	]
}