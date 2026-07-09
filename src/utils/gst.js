function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function calculateLineItem({ qty, rate, discount = 0, gst_rate = 0, taxType = 'IGST' }) {
  const taxableValue = round2(Number(qty) * Number(rate) - Number(discount || 0));
  const gstAmount = round2((taxableValue * Number(gst_rate || 0)) / 100);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (taxType === 'CGST_SGST') {
    cgst = round2(gstAmount / 2);
    sgst = round2(gstAmount / 2);
  } else {
    igst = gstAmount;
  }

  return {
    taxable_value: taxableValue,
    cgst,
    sgst,
    igst,
    total: round2(taxableValue + cgst + sgst + igst)
  };
}

function amountToWordsIndian(num) {
  num = Math.round(Number(num || 0));
  if (num === 0) return 'ZERO RUPEES ONLY';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim();
  }

  function threeDigits(n) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    return `${hundred ? ones[hundred] + ' Hundred ' : ''}${rest ? twoDigits(rest) : ''}`.trim();
  }

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const rest = num;

  const parts = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));

  return `${parts.join(' ')} Rupees Only`.toUpperCase();
}

module.exports = { round2, calculateLineItem, amountToWordsIndian };
