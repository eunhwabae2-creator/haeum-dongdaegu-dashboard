(() => {
  const control = document.querySelector('.filters');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'upload';
  button.id = 'refreshApi';
  button.textContent = '↻ 실거래 불러오기';
  control.prepend(button);

  const asNumber = value => Number(String(value || '0').replace(/,/g, '')) || 0;
  const median = values => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  };
  const wonLabel = amount => {
    const value = Math.round(amount);
    return value >= 10000
      ? `${Math.floor(value / 10000)}억 ${String(value % 10000).padStart(4, '0')}만원`
      : `${value.toLocaleString()}만원`;
  };
  async function readItems(response) {
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (text.trim().startsWith('{')) {
      const json = JSON.parse(text);
      const body = json.response?.body || json.body || json;
      const items = body.items?.item || body.items || [];
      return Array.isArray(items) ? items : items ? [items] : [];
    }
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    const code = xml.querySelector('resultCode')?.textContent;
    if (code && code !== '00') throw new Error(xml.querySelector('resultMsg')?.textContent || `API 오류 ${code}`);
    return [...xml.querySelectorAll('items item')].map(item =>
      Object.fromEntries([...item.children].map(node => [node.tagName, node.textContent.trim()])));
  }
  async function request(base, month, serviceKey) {
    const url = new URL(base);
    url.searchParams.set('serviceKey', serviceKey);
    url.searchParams.set('LAWD_CD', '27140');
    url.searchParams.set('DEAL_YMD', month);
    url.searchParams.set('pageNo', '1');
    url.searchParams.set('numOfRows', '1000');
    url.searchParams.set('_type', 'json');
    return readItems(await fetch(url));
  }
  function normalize(record, type) {
    const area = asNumber(record.excluUseAr);
    const date = `${record.dealYear}.${String(record.dealMonth || '').padStart(2, '0')}.${String(record.dealDay || '').padStart(2, '0')}`;
    const common = { apt: record.aptNm || '단지명 미상', dong: record.umdNm || '동구', area, date };
    if (type === 'sale') {
      const amount = asNumber(record.dealAmount);
      return { ...common, kind: type, amount, deposit: amount, rent: 0, label: wonLabel(amount) };
    }
    const deposit = asNumber(record.deposit);
    const rent = asNumber(record.monthlyRent);
    const kind = rent > 0 ? 'rent' : 'jeonse';
    return { ...common, kind, amount: kind === 'rent' ? rent : deposit, deposit, rent,
      label: kind === 'rent' ? `${wonLabel(deposit)} / ${rent.toLocaleString()}만원` : wonLabel(deposit) };
  }
  button.addEventListener('click', async () => {
    let serviceKey = window.DONGGU_API_KEY || localStorage.getItem('DONGGU_API_KEY');
    if (!serviceKey) {
      serviceKey = window.prompt('공공데이터포털 API 인증키를 입력하세요. 키는 이 브라우저에만 저장되며 GitHub에는 올라가지 않습니다.');
      if (serviceKey) localStorage.setItem('DONGGU_API_KEY', serviceKey.trim());
      serviceKey = serviceKey?.trim();
    }
    if (!serviceKey) {
      alert('API 키가 없어 실거래를 조회하지 않았습니다.');
      return;
    }
    button.disabled = true;
    button.textContent = '조회 중…';
    try {
      const selection = document.querySelector('#period').value;
      const count = selection.includes('3개월') ? 3 : selection.includes('6개월') ? 6 : 12;
      const now = new Date();
      const months = Array.from({ length: count }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - count + index + 1, 1);
        return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
      });
      const saleApi = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';
      const rentApi = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent';
      const transactions = [];
      for (const month of months) {
        transactions.push(...(await request(saleApi, month, serviceKey)).map(row => normalize(row, 'sale')));
        transactions.push(...(await request(rentApi, month, serviceKey)).map(row => normalize(row, 'rent')));
      }
      const stationTransactions = transactions.filter(row => inSelectedArea(row.dong));
      const groups = {
        sale: stationTransactions.filter(row => row.kind === 'sale'),
        jeonse: stationTransactions.filter(row => row.kind === 'jeonse'),
        rent: stationTransactions.filter(row => row.kind === 'rent')
      };
      for (const kind of Object.keys(groups)) {
        groups[kind].sort((a, b) => b.amount - a.amount);
        demo[kind] = groups[kind].slice(0, 10).map(row =>
          [row.apt, row.dong, row.area.toFixed(2), row.date, row.label, '—']);
        const values = months.map(month => median(groups[kind]
          .filter(row => row.date.startsWith(`${month.slice(0, 4)}.${month.slice(4)}.`))
          .map(row => row.amount)));
        const base = values.find(value => value > 0) || 1;
        series[kind] = values.map(value => value ? Number((value / base * 100).toFixed(1)) : 100);
        priceFlow[kind] = values.slice(-6).map(value => kind === 'rent' ? value : (value / 10000 || 0));
        const ranked = groups[kind].filter(row => row.area > 0)
          .map(row => ({ ...row, perPyeong: Math.round(row.amount / row.area * 3.3058) }))
          .sort((a, b) => b.perPyeong - a.perPyeong).slice(0, 10)
          .map(row => [row.apt, row.dong, row.area.toFixed(1), row.perPyeong.toLocaleString()]);
        if (ranked.length) pyeong[kind] = ranked;
      }
      apiTransactions = transactions;
      renderIndex(); renderPrice(); renderTop(); renderPyeong('sale'); renderPyeong(kindPyeong);\n      if (kindPrice === 'rent') { document.querySelector('#priceInsight').innerHTML = '<b>월세 시장</b> · 최근 계약의 월차임 중위가격 흐름입니다.'; document.querySelector('.two .panel:nth-child(2) .sub').textContent = '최근 6개월 · 만원/월'; }
      const axisLabels = months.map(month => `${Number(month.slice(4))}월`);
      const reaxis = (id, labels, left, width, y) => {
        const svg = document.querySelector(id);
        svg.querySelectorAll(`text[y="${y}"]`).forEach(node => node.remove());
        labels.forEach((label, index) => {
          const node = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          node.setAttribute('x', String(left + index * width / Math.max(1, labels.length - 1)));
          node.setAttribute('y', String(y));
          node.setAttribute('text-anchor', 'middle');
          node.textContent = label;
          svg.append(node);
        });
      };
      reaxis('#indexChart', axisLabels, 42, 640, 232);
      reaxis('#priceChart', axisLabels.slice(-6), 42, 375, 232);
      document.querySelector('.kpi:nth-child(1) .kpi-value').textContent = (median(groups.sale.map(row => row.amount)) / 10000).toFixed(2);
      document.querySelector('.kpi:nth-child(2) .kpi-value').textContent = (median(groups.jeonse.map(row => row.amount)) / 10000).toFixed(2);
      document.querySelector('.kpi:nth-child(3) .kpi-value').textContent = median(groups.rent.map(row => row.deposit)).toLocaleString();
      document.querySelector('.kpi:nth-child(4) .kpi-value').textContent = transactions.length.toLocaleString();
      document.querySelector('.profile span').textContent = `${months.at(-1)} 계약월 기준`;
      document.querySelector('.badge').textContent = '공공데이터 연동';
      document.querySelector('.source').innerHTML = `출처: <a href="https://www.data.go.kr/data/15126469/openapi.do" target="_blank" rel="noopener">국토교통부 아파트 매매 실거래가</a> · <a href="https://www.data.go.kr/data/15126474/openapi.do" target="_blank" rel="noopener">아파트 전월세 실거래가</a>. 최근 ${count}개월 신고분. 기본 역 주변 생활권은 신암·신천·효목동 단위로 근사했으며 정확한 거리 반경은 아닙니다. 가격지수는 조회기간 첫 달의 월별 중위 실거래가를 100으로 환산한 자체 지표입니다. 월세 순위·평당가격은 월차임 기준입니다. 신고·정정 시점에 따라 값이 바뀔 수 있습니다.`;
      alert(`${transactions.length.toLocaleString()}건의 실거래 자료를 불러왔습니다.`);
    } catch (error) {
      console.error(error);
      alert(`공공데이터 조회 실패: ${error.message}. 서비스 활용 신청, 키, 네트워크를 확인해 주세요.`);
    } finally {
      button.disabled = false;
      button.textContent = '↻ 실거래 불러오기';
    }
  });
})();


