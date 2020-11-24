module.exports = {
	logStart() {
		console.log('Bot has been started ...')
	},

	getChatId(msg) {
		return msg.chat.id
	},

	getItemUuid(sourse) {
		return sourse.substring(2, sourse.length)
	}
}