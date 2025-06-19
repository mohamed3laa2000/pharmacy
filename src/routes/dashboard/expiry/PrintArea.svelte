<script>
	export let expired = [];
</script>

<div
	id="print-area"
	style="background: #fff; color: #222; padding: 2rem; width: 21cm; height: 29.65cm; direction: rtl; font-family: 'Tajawal', Arial, sans-serif;"
>
	<div style="display: flex; justify-content: space-between; align-items: flex-start;">
		<img src="/logo.svg" alt="logo" style="height: 60px;" />
	</div>
	<h2
		style="font-weight: bold; text-align: center; margin: 1rem 0; color: #007a3d; font-size: 1.5rem;"
	>
		محضر إتلاف
	</h2>
	<div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
		<span
			>انه في يوم ................. بتاريخ ................. هـ، وفي الساعة ( ................. ) تم
			اتلاف الادوية ادناه:</span
		>
		<span></span>
	</div>
	<table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem;">
		<thead>
			<tr style="background: #e5e7eb;">
				<th style="border: 1px solid #999; padding: 4px;">م</th>
				<th style="border: 1px solid #999; padding: 4px;">البيان/الوصف</th>
				<th style="border: 1px solid #999; padding: 4px;">العدد/الكمية</th>
				<th style="border: 1px solid #999; padding: 4px;">تاريخ الانتهاء</th>
				<th style="border: 1px solid #999; padding: 4px;">رقم التشغيله</th>
			</tr>
		</thead>
		<tbody>
			{#each expired.slice(0, 10) as item, i}
				<tr>
					<td style="border: 1px solid #999; padding: 4px;">{i + 1}</td>
					<td style="border: 1px solid #999; padding: 4px;">{item.medicineName}</td>
					<td style="border: 1px solid #999; padding: 4px;">{item.quantity}</td>
					<td style="border: 1px solid #999; padding: 4px;">{item.expiry}</td>
					<td style="border: 1px solid #999; padding: 4px;">{item.batchId}</td>
				</tr>
			{/each}
			{#each Array(10 - expired.length) as _, i}
				<tr>
					<td style="border: 1px solid #999; padding: 4px;">{expired.length + i + 1}</td>
					<td style="border: 1px solid #999; padding: 4px;">&nbsp;</td>
					<td style="border: 1px solid #999; padding: 4px;">&nbsp;</td>
					<td style="border: 1px solid #999; padding: 4px;">&nbsp;</td>
					<td style="border: 1px solid #999; padding: 4px;">&nbsp;</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<div style="margin-bottom: 1rem;">وذلك لعدم صلاحيتها للاستعمال. وهذا محضر بما تم ...</div>
	<table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem;">
		<thead>
			<tr style="background: #e5e7eb;">
				<th style="border: 1px solid #999; padding: 4px;">المهنة</th>
				<th style="border: 1px solid #999; padding: 4px;">الاسم</th>
				<th style="border: 1px solid #999; padding: 4px;">التوقيع</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td style="border: 1px solid #999; padding: 4px;">صيدلي</td>
				<td style="border: 1px solid #999; padding: 4px;"></td>
				<td style="border: 1px solid #999; padding: 4px;"></td>
			</tr>
			<tr>
				<td style="border: 1px solid #999; padding: 4px;">طبيب</td>
				<td style="border: 1px solid #999; padding: 4px;"></td>
				<td style="border: 1px solid #999; padding: 4px;"></td>
			</tr>
			<tr>
				<td style="border: 1px solid #999; padding: 4px;">ممرض</td>
				<td style="border: 1px solid #999; padding: 4px;"></td>
				<td style="border: 1px solid #999; padding: 4px;"></td>
			</tr>
		</tbody>
	</table>
	<div style="margin-bottom: 1rem;">
		وتم تسليمها للشركة: ...........................................
	</div>
	<div style="margin-bottom: 1rem;">
		الموظف المسؤول: ...........................................
	</div>
	<div>التوقيع: ...........................................</div>
</div>
