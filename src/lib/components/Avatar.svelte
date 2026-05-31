<script lang="ts">
	let { name = '', size = 'sm' }: { name?: string; size?: 'xs' | 'sm' | 'md' } = $props();

	// Chakra-style initials from name.
	const initials = $derived(
		name
			.split(/\s+/)
			.map((p) => p[0])
			.filter(Boolean)
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);

	// Deterministic background color from the name.
	const palette = ['#E2E8F0', '#B2F5EA', '#BEE3F8', '#FEEBC8', '#FED7D7', '#E9D8FD', '#C6F6D5'];
	const bg = $derived.by(() => {
		let hash = 0;
		for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
		return palette[hash % palette.length];
	});
</script>

<span class="avatar size-{size}" style="background:{bg}" title={name}>{initials}</span>

<style>
	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		color: #1a202c;
		font-weight: 600;
		flex-shrink: 0;
		user-select: none;
	}
	.size-xs {
		width: 24px;
		height: 24px;
		font-size: 10px;
	}
	.size-sm {
		width: 32px;
		height: 32px;
		font-size: 12px;
	}
	.size-md {
		width: 48px;
		height: 48px;
		font-size: 18px;
	}
</style>
