export class LogBuffer<T> {
	private buffer: T[] = [];
	constructor(private limit: number = 1000) {}

	push(event: T) {
		this.buffer.push(event);
		if (this.buffer.length > this.limit) this.buffer.shift();
	}

	getHistory() {
		return this.buffer;
	}
}
