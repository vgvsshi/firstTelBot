const { Schema, model } = require('mongoose')

const UserSchema = new Schema({
	telegramId: {
		type: Number,
		required: true
	},
	films: {
		type: [String],
		default: []
	}
})

module.exports = model('Users', UserSchema)