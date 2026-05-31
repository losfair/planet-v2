<script lang="ts">
	let {
		name,
		price,
		note = '',
		features
	}: { name: string; price: number; note?: string; features: [string, string][] } = $props();
</script>

<div class="pricing-card">
	<div class="name">{name}</div>
	<div class="price">
		<span>${price}</span><span class="per">/month</span>
	</div>
	<div class="note">{note}</div>
	<table>
		<tbody>
			{#each features as [k, v] (k)}
				<tr>
					<td>{k}</td>
					<td class="val">{#if v === '✓'}<span class="check">✓</span>{:else}{v}{/if}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.pricing-card {
		display: flex;
		flex-direction: column;
		height: 100%;
		border-radius: 10px;
		padding: 20px 8px;
		background: #fff;
		box-shadow: var(--shadow-md);
		align-items: center;
	}
	.name {
		font-weight: bold;
		font-size: 20px;
	}
	.price {
		color: var(--chakra-colors-teal-500);
		font-size: 35px;
		margin-top: 8px;
	}
	.per {
		font-size: 18px;
		color: var(--chakra-colors-gray-500);
	}
	.note {
		height: 30px;
		font-size: 14px;
		color: var(--chakra-colors-gray-500);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
	}
	td {
		padding: 4px 12px;
		color: #1a202c;
	}
	.val {
		font-weight: bold;
		text-align: right;
	}
	.check {
		color: #1a202c;
	}
</style>
