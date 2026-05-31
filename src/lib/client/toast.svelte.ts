export interface Toast {
	id: number;
	title: string;
	description?: string;
	status: 'success' | 'error' | 'info' | 'warning';
}

class ToastStore {
	items = $state<Toast[]>([]);
	private nextId = 1;

	show(t: Omit<Toast, 'id'>) {
		const id = this.nextId++;
		this.items = [...this.items, { ...t, id }];
		setTimeout(() => this.dismiss(id), 5000);
	}

	dismiss(id: number) {
		this.items = this.items.filter((t) => t.id !== id);
	}
}

export const toast = new ToastStore();
