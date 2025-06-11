<script>
	export let error;
	export let status;
</script>

<div class="h-screen flex items-center justify-center bg-green-50">
	<div class="flex flex-col items-center">
		<img src="/logo.svg" alt="" class="mb-4" />
		<h1 class="text-6xl font-extrabold text-green-700 mb-2">{status}</h1>
		<h2 class="text-2xl font-semibold mb-4">
			{status === 404 ? 'عذراً، هذه الصفحة غير متوفرة في صيدليتنا!' : 'حدث خطأ غير متوقع في النظام'}
		</h2>
		<p class="mb-8 text-gray-500">
			{status === 404 ? 'ربما انتهت صلاحيتها أو لم يتم صرفها بعد.' : error?.message}
		</p>
		<a href="/dashboard" class="px-6 py-2 bg-(--green_dark) text-white rounded transition">
			العودة للوحة التحكم
		</a>
	</div>
</div>
