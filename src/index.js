const TelegramBot = require('node-telegram-bot-api')
const mongoose = require('mongoose')
const config = require('./config')
const helper = require('./helper')
const keyboard = require('./keyboard')
const kb = require('./keyboardBtns')
const geolib = require('geolib')
const _ = require('lodash')
const database = require('../database.json')
const Films = require('./models/film-model')
const Cinema = require('./models/cinema-model')
const Users = require('./models/user-model')
const { home } = require('./keyboardBtns')

helper.logStart()

mongoose.connect(config.DB_URL, {
	useFindAndModify: true,
	useUnifiedTopology: true,
	useNewUrlParser: true
})
	.then(() => { console.log('Mongo connected') })
	.catch((err) => { console.log(err) })

// database.films.forEach(f => { new Films(f).save() })

// database.cinemas.forEach(c => { new Cinema(c).save() })

const ACTION_TYPE = {
	TOGGLE_FAV_FILM: 'tff',
	SHOW_CINEMAS: 'sc',
	SHOW_CINEMAS_MAP: 'scm',
	SHOW_FILMS: 'sf'
}

//=========================================

const bot = new TelegramBot(config.TOKEN, {
	polling: {
		interval: 300,
		autoStart: true,
		params: {
			timeout: 10
		}
	}
})

bot.on('message', (msg) => {

	const chatId = helper.getChatId(msg)

	switch (msg.text) {
		case kb.home.favorite:
			showFavoriteFilms(chatId, msg.from.id)
			break
		case kb.home.films:
			bot.sendMessage(chatId, `Выберте жанр:`, {
				reply_markup: {
					keyboard: keyboard.film
				}
			})
			break
		case kb.film.comedy:
			sendFilmsByQuery(chatId, { type: 'comedy' })
			break
		case kb.film.action:
			sendFilmsByQuery(chatId, { type: 'action' })
			break
		case kb.film.random:
			sendFilmsByQuery(chatId, {})
			break
		case kb.home.cinemas:
			bot.sendMessage(chatId, `Отправить местоположение`, {
				reply_markup: {
					keyboard: keyboard.cinemas
				}
			})
			break
		case kb.back:
			bot.sendMessage(chatId, `Что хотите посмотреть?`, {
				reply_markup: {
					keyboard: keyboard.home
				}
			})
			break
	}

	if (msg.location) {
		console.log(msg.location)
		getCinemasInCoords(chatId, msg.location)
	}

})

bot.onText(/\/start/, msg => {

	const text = `Здравствуйте, ${msg.from.first_name}\nВыберите команду для начала работы:`

	bot.sendMessage(helper.getChatId(msg), text, {
		reply_markup: {
			keyboard: keyboard.home
		}
	})



})

bot.onText(/\/f(.+)/, (msg, [sourse, match]) => {
	const chatId = helper.getChatId(msg)
	const filmUuid = helper.getItemUuid(sourse)
	console.log(filmUuid)

	Promise.all([
		Films.findOne({ uuid: filmUuid }),
		Users.findOne({ telegramId: msg.from.id })
	]).then((([film, user]) => {

		let isFav = false

		if (user) {
			isFav = user.films.indexOf(film.uuid) !== -1
		}

		const favText = isFav ? 'Удалить из избранного' : 'Добавить в избранное'

		const caption = `Название: ${film.name}\nГод: ${film.year}\nРейтинг: ${film.rate}\nДлительность: ${film.length}\nСтрана: ${film.country}`

		bot.sendPhoto(chatId, film.picture, {
			caption,
			reply_markup: {
				inline_keyboard: [
					[
						{
							text: favText,
							callback_data: JSON.stringify({
								type: ACTION_TYPE.TOGGLE_FAV_FILM,
								filmUuid: film.uuid,
								isFav: isFav
							})
						},
						{
							text: 'Показать кинотеатры',
							callback_data: JSON.stringify({
								type: ACTION_TYPE.SHOW_CINEMAS,
								cinemaUuids: film.cinemas
							})
						}
					],
					[
						{
							text: `Кинопоиск ${film.name}`,
							url: film.link
						}
					]
				]
			}
		})
	})
	)
})

bot.onText(/\/c(.+)/, (msg, [sourse, match]) => {
	const cinemaUuid = helper.getItemUuid(sourse)
	const chatId = helper.getChatId(msg)

	Cinema.findOne({ uuid: cinemaUuid }).then(cinema => {

		bot.sendMessage(chatId, `Кинотеатр ${cinema.name}`, {
			reply_markup: {
				inline_keyboard: [
					[
						{
							text: cinema.name,
							url: cinema.url
						},
						{
							text: "Показать на карте",
							callback_data: JSON.stringify({
								type: ACTION_TYPE.SHOW_CINEMAS_MAP,
								lat: cinema.location.latitude,
								lon: cinema.location.longitude
							})
						}
					],
					[
						{
							text: 'Показать фильмы',
							callback_data: JSON.stringify({
								type: ACTION_TYPE.SHOW_FILMS,
								filmUuids: cinema.films
							})
						}
					]
				]
			}
		})
	})
})

bot.on('inline_query', query => {
	Films.find().then(films => {
		const results = films.map(film => {
			return {
				id: film.uuid,
				type: 'photo',
				photo_url: film.picture,
				thumb_url: film.picture,
				caption: `Название: ${film.name}\nГод: ${film.year}\nРейтинг: ${film.rate}\nДлительность: ${film.length}\nСтрана: ${film.country}`,
				reply_markup: {
					inline_keyboard: [
						[
							{
								text: `Кинопоиск ${film.name}`,
								url: film.link
							}
						]
					]
				}
			}
		})

		bot.answerInlineQuery(query.id, results, {
			cache_time: 0
		})
	})
})

bot.on('callback_query', query => {
	let data
	const userId = query.from.id
	try {
		data = JSON.parse(query.data)
	} catch (e) {
		throw new Error('Data is not in object')
	}
	const { type } = data

	if (type === ACTION_TYPE.SHOW_CINEMAS_MAP) {
		const { lat, lon } = data
		bot.sendLocation(query.message.chat.id, lat, lon)
	} else if (type === ACTION_TYPE.SHOW_CINEMAS) {
		sendCinemasByQuery(userId, { uuid: { '$in': data.cinemaUuids } })
	} else if (type === ACTION_TYPE.TOGGLE_FAV_FILM) {
		toggleFavFilm(userId, query.id, data)
	} else if (type === ACTION_TYPE.SHOW_FILMS) {
		sendFilmsByQuery(userId, { uuid: { '$in': data.filmUuids } })
	}
})
//=================================

function sendFilmsByQuery(chatId, query) {
	Films.find(query).then(films => {

		const html = films.map((f, i) => {
			return `<b>${i + 1}</b> ${f.name} - /f${f.uuid}`
		}).join('\n')

		sendHtml(chatId, html, keyboard.film)
	})
}

function sendHtml(chatId, html, kbName = null) {
	const options = {
		parse_mode: "HTML"
	}

	if (kbName) {
		options['reply_markup'] = {
			keyboard: kbName
		}
	}

	bot.sendMessage(chatId, html, options)
}

function getCinemasInCoords(chatId, location) {
	Cinema.find().then(cinemas => {

		cinemas.forEach(c => {
			c.distance = geolib.getDistance(location, c.location) / 1000
		})

		cinemas = _.sortBy(cinemas, 'distance')

		const html = cinemas.map((c, i) => {
			return `<b>${i + 1}</b> ${c.name}. <em>Расстояние</em> - <strong>${c.distance}</strong> км. /c${c.uuid}`
		}).join('\n')

		sendHtml(chatId, html, keyboard.home)

	})
}

function toggleFavFilm(userId, queryId, { filmUuid, isFav }) {

	let userPromise

	Users.findOne({ telegramId: userId })
		.then(user => {
			if (user) {
				if (isFav) {
					user.films = user.films.filter(uuid => uuid !== filmUuid)
				} else {
					user.films.push(filmUuid)
				}
				userPromise = user
			} else {
				userPromise = new Users({
					telegramId: userId,
					films: [filmUuid]
				})
			}

			const answerText = isFav ? 'Удалено' : 'Добавлено'

			userPromise.save().then(_ => {
				bot.answerCallbackQuery({
					callback_query_id: queryId,
					text: answerText
				})
			}).catch((e) => {
				console.log(e.messahe)
			})

		})
}

function showFavoriteFilms(chatId, userId) {
	Users.findOne({ telegramId: userId })
		.then(user => {
			if (user) {
				Films.find({ uuid: { '$in': user.films } }).then(films => {
					let html
					if (films.length) {
						html = films.map((f, i) => {
							return `<b>${i + 1}</b> ${f.name} - <b>${f.rate}</b>(/f${f.uuid})`
						}).join('\n')
					} else {
						html = 'Вы пока ничего не добавили'
					}
					sendHtml(chatId, html, keyboard.home)
				}).catch(e => { console.log(e) })
			} else {
				sendHtml(chatId, 'Вы пока ничего не добавили', keyboard.home)
			}

		}).catch(e => {
			console.log(e)
		})
}

function sendCinemasByQuery(userId, query) {
	Cinema.find(query).then(cinema => {

		const html = cinema.map((c, i) => {
			return `<b>${i + 1}</b> ${c.name} - /c${c.uuid}`
		}).join('\n')

		sendHtml(userId, html, keyboard.home)
	})
}