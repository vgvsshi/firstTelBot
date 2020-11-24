const { Schema, model } = require('mongoose')

const FilmSchema = new Schema({
	name: { type: String, required: true },
	type: { type: String, required: true },
	uuid: { type: String, required: true },
	year: String,
	rate: Number,
	length: String,
	county: String,
	link: String,
	picture: String,
	cinemas: {
		type: [String],
		default: []
	}
})

module.exports = model('Films', FilmSchema)

