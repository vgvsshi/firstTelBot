const { Schema, model } = require('mongoose')

const CinemaSchema = new Schema({
	uuid: { type: String, required: true },
	name: { type: String, required: true },
	url: { type: String, required: true },
	location: {
		type: Schema.Types.Mixed
	},
	films: {
		type: [String],
		default: []
	}
})

module.exports = model('Cinema', CinemaSchema)