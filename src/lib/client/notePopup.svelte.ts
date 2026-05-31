class NotePopup {
	idWithUsername = $state<string | null>(null);

	open(idWithUsername: string) {
		this.idWithUsername = idWithUsername;
	}
	close() {
		this.idWithUsername = null;
	}
}

export const notePopup = new NotePopup();
