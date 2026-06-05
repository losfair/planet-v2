<script lang="ts">
	import { untrack } from 'svelte';
	let { data } = $props();
	const user = untrack(() => data.user);
	const year = new Date().getFullYear();
</script>

<svelte:head><title>Planet</title></svelte:head>

<div class="landing">
	<header>
		<div class="brand">
			<img src="/icon.svg" alt="" width="26" />
			<span>Planet</span>
			<span class="beta">BETA</span>
		</div>
		<div>
			{#if user && user.username}
				<a href={`/people/${user.username}/notes`}>{user.username}</a>
			{:else}
				<a href={data.loginUrl}>Sign in</a>
			{/if}
		</div>
	</header>

	<section class="card">
		<div class="card-inner">
			<div class="col text">
				<div class="hero-headings">
					<h1 class="g-write">Write.</h1>
					<h1 class="g-connect">Connect.</h1>
					<h1 class="g-share">Share.</h1>
				</div>
				<p class="lede">
					Planet is a knowledge management app that helps you take short notes, make sense of them,
					and share with your communities.
				</p>
				<a class="cta" href="/signup">Start for free</a>
			</div>
			<div class="col media">
				<div class="placeholder shot">Your notes, beautifully organized</div>
			</div>
		</div>
	</section>

	<section class="card">
		<div class="card-inner">
			<div class="col text">
				<h2>Tools you need to organize your thoughts.</h2>
				<p><strong>Write:</strong> Note down your thoughts on the web app or through our Telegram bot. We help you bring them together.</p>
				<p><strong>Connect:</strong> Bidirectional links, nested hashtags, network graphs, and automatic image analysis.</p>
				<p>You don't need to have a structure in mind before writing. Just focus on ideas; the structure will emerge.</p>
			</div>
			<div class="col media">
				<div class="placeholder">Links · Hashtags · Graphs</div>
			</div>
		</div>
	</section>

	<section class="card">
		<div class="card-inner">
			<div class="col text">
				<h2>Share ideas with your communities,<br /><span class="g-pink">without frictions.</span></h2>
				<p><strong>Share:</strong> Use the same tools for organizing private notes — bidirectional links and network graphs work across the user boundary.</p>
				<p>
					Knowledge network is a complex system and has its own spontaneous order. We think of our role
					as to build the necessary structures for mindful discussions.
				</p>
				<ul class="ticks">
					<li>Personal note-taking</li>
					<li>Sharing knowledge and ideas with your communities</li>
					<li>Running a publication and linking together discussions</li>
				</ul>
			</div>
			<div class="col media">
				<div class="placeholder globe">🌐</div>
			</div>
		</div>
	</section>

	<section class="card">
		<div class="card-inner">
			<div class="col text">
				<h2>Integrated with long note workflows.</h2>
				<p>
					A network of short notes is Planet's fundamental structure, on top of which
					<strong>long notes</strong> can be organized as well. Planet integrates with existing
					workflows for taking long notes, including Notion and even pen and paper.
				</p>
			</div>
			<div class="col media">
				<div class="placeholder">Notion · Documents</div>
			</div>
		</div>
	</section>

	<div class="pricing">
		<p class="discord">Join our community on <a href="https://discord.gg/WRuX5SXQ2u">Discord</a>!</p>
		<hr />
		<footer>
			<a href="/docs/api">Documentation</a>
			<span class="sep">|</span>
			<span>z@metasymbolic.studio</span>
			<span class="sep">|</span>
			<span>&copy; {year} <a href="https://metasymbolic.studio/">MetaSymbolic Studio</a></span>
		</footer>
	</div>
</div>

<style>
	/* Landing is always light (original wraps in <LightMode>). */
	.landing {
		background: #fff;
		color: #1a202c;
		min-height: 100vh;
	}
	header {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 25px;
		font-size: 18px;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(5px);
		box-shadow: var(--shadow-sm);
		z-index: 2;
	}
	header a {
		text-decoration: none;
		color: #1a202c;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.beta {
		font-size: 11px;
		font-weight: 700;
		color: #fff;
		background: var(--chakra-colors-teal-500);
		border-radius: 6px;
		padding: 1px 6px;
	}
	.card-inner {
		max-width: 80rem;
		margin: 0 auto;
		display: flex;
		gap: 24px;
		padding: 60px 35px;
		min-height: 600px;
		align-items: center;
		justify-content: center;
	}
	.col {
		flex: 1;
		min-width: 300px;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 450px;
	}
	.hero-headings h1 {
		font-size: 48px;
		margin: 0;
		line-height: 1.1;
	}
	.g-write {
		background: linear-gradient(to left, #000, #606060);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.g-connect {
		background: linear-gradient(to left, #0077b6, #00b4d8);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.g-share {
		background: linear-gradient(to left, #d74228, #ff674d);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.g-pink {
		background: linear-gradient(to left, #7928ca, #ff0080);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	h2 {
		font-size: 32px;
		margin: 0;
	}
	.lede,
	.text p {
		font-size: 20px;
		margin: 0;
	}
	.cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 160px;
		height: 48px;
		background: var(--chakra-colors-gray-800);
		color: #fff;
		border-radius: 3px;
		text-decoration: none;
		font-weight: 600;
		box-shadow: var(--shadow-base);
	}
	.ticks {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		font-size: 18px;
	}
	.ticks li::before {
		content: '✓';
		color: var(--chakra-colors-green-500);
		margin-right: 8px;
		font-weight: bold;
	}
	.media {
		display: flex;
		justify-content: center;
	}
	.placeholder {
		width: 100%;
		max-width: 800px;
		aspect-ratio: 16 / 10;
		border-radius: 12px;
		background: linear-gradient(135deg, #ebf8ff, #e6fffa);
		border: 1px solid var(--chakra-colors-gray-200);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--chakra-colors-gray-500);
		font-size: 18px;
		box-shadow: var(--shadow-base);
	}
	.globe {
		font-size: 120px;
		background: radial-gradient(circle at 50% 40%, #bee3f8, #ebf8ff);
	}
	.pricing {
		max-width: 7xl;
		padding: 60px 20px;
		text-align: center;
	}
	.discord {
		padding-top: 45px;
		font-size: 20px;
	}
	a {
		color: var(--chakra-colors-teal-500);
	}
	hr {
		margin: 70px auto 0;
		max-width: 1100px;
		border: none;
		border-top: 1px solid var(--chakra-colors-gray-200);
	}
	footer {
		max-width: 1100px;
		margin: 0 auto;
		padding: 30px 0 40px;
		display: flex;
		gap: 12px;
		font-size: 14px;
		color: var(--chakra-colors-gray-500);
		justify-content: center;
		flex-wrap: wrap;
	}
	footer a {
		color: var(--chakra-colors-gray-500);
		text-decoration: underline;
	}
	@media (max-width: 768px) {
		.card-inner {
			flex-direction: column;
			padding: 40px 20px;
		}
	}
</style>
