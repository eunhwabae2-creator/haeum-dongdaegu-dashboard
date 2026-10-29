(() => {
  const modal = document.querySelector('#modal');
  const title = document.querySelector('#modalTitle');
  const text = document.querySelector('#modalText');
  const details = document.querySelector('#aptTradeDetails');
  const frame = document.querySelector('#mapFrame');
  const external = document.querySelector('#externalMap');
  const kbUrl = 'https://kbland.kr/';
  const kinds = ['sale', 'jeonse', 'rent'];
  const kindNames = { sale: '매매', jeonse: '전세', rent: '월세' };
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const wonLabel = amount => {
    const value = Math.round(Number(amount) || 0);
    return value >= 10000 ? `${Math.floor(value / 10000)}억 ${String(value % 10000).padStart(4, '0')}만원` : `${value.toLocaleString()}만원`;
  };

  function sampleRows(apartment, dong) {
    return kinds.flatMap(kind => (demo[kind] || []).filter(row => row[0] === apartment && row[1] === dong)
      .map(row => ({ kind, apartment: row[0], dong: row[1], area: Number(row[2]), date: row[3], label: row[4] })));
  }
  function liveRows(apartment, dong) {
    return Array.isArray(apiTransactions)
      ? apiTransactions.filter(row => row.apt === apartment && row.dong === dong)
      : null;
  }
  function cellFor(list, kind) {
    const row = list.filter(item => item.kind === kind).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!row) return '<span class="kb-missing">최근 계약 없음</span>';
    const amount = row.label || (kind === 'rent'
      ? `보증금 ${wonLabel(row.deposit)} · 월 ${Number(row.rent || 0).toLocaleString()}만원`
      : wonLabel(row.amount));
    return `<b>${safe(amount)}</b><small>${safe(row.date)} · ${list.filter(item => item.kind === kind).length}건</small>`;
  }
  function renderTradeDetails(apartment, dong) {
    const actual = liveRows(apartment, dong);
    const records = actual === null ? sampleRows(apartment, dong) : actual;
    const byArea = new Map();
    for (const record of records) {
      if (!Number(record.area)) continue;
      const area = Number(record.area).toFixed(1);
      if (!byArea.has(area)) byArea.set(area, []);
      byArea.get(area).push(record);
    }
    const status = actual === null
      ? '화면 예시 데이터입니다. 상단의 “실거래 불러오기”를 실행하면 공공데이터포털 거래 내역으로 바뀝니다.'
      : `공공데이터포털 실거래 ${records.length.toLocaleString()}건 · 선택 기간 내 신고자료`;
    if (!byArea.size) {
      details.innerHTML = `<div class="detail-empty">${safe(status)}<br><br>${actual === null ? '이 예시 단지의 면적별 거래 표본은 준비되어 있지 않습니다.' : '선택 기간에 이 단지의 거래 내역이 없습니다.'} KB시세는 별도 연결되지 않아 자동 표시되지 않습니다. <a href="${kbUrl}" target="_blank" rel="noopener">KB부동산에서 단지 검색 ↗</a></div>`;
      return;
    }
    const rows = [...byArea.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([area, list]) => {
      const pyeong = (Number(area) / 3.3058).toFixed(1);
      return `<tr><td><b>전용 ${safe(area)}㎡</b><small>약 ${pyeong}평</small></td>${kinds.map(kind => `<td>${cellFor(list, kind)}</td>`).join('')}<td><span class="kb-missing">자동 연동 없음</span><a href="${kbUrl}" target="_blank" rel="noopener">KB부동산에서 단지 검색 ↗</a></td></tr>`;
    }).join('');
    details.innerHTML = `<div class="detail-toolbar"><strong>전용면적별 최근 실거래</strong><span class="detail-status">${safe(status)}</span></div><div class="detail-table-wrap"><table class="detail-table"><thead><tr><th>전용면적</th><th>매매</th><th>전세</th><th>월세</th><th>KB시세</th></tr></thead><tbody>${rows}</tbody></table></div><div class="detail-empty" style="margin-top:8px">실거래는 해당 면적의 최신 계약금액과 조회기간 내 계약 건수를 표시합니다. KB시세는 이 대시보드에 공식 데이터 연동이 없어 값을 표시하지 않습니다.</div>`;
  }
  function showDetails(row) {
    const apartment = row.dataset.apt;
    const dong = row.dataset.dong || '';
    const search = `${apartment}, ${dong}, Dong-gu, Daegu, South Korea`;
    title.textContent = apartment;
    text.textContent = `${dong} · 면적별 매매·전세·월세 실거래와 KB시세 연결 상태`;
    renderTradeDetails(apartment, dong);
    frame.src = `https://maps.google.com/maps?q=${encodeURIComponent(search)}&output=embed`;
    external.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}`;
    modal.style.display = 'flex';
    document.querySelector('#closeModal').focus();
  }
  document.addEventListener('click', event => {
    const row = event.target.closest('.map-row');
    if (row) showDetails(row);
  });
  document.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.map-row')) {
      event.preventDefault();
      showDetails(event.target);
    }
    if (event.key === 'Escape') closeModal();
  });
  function closeModal() {
    modal.style.display = 'none';
    frame.src = 'about:blank';
  }
  document.querySelector('#closeModal').addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
})();

