// ============================================================
// tokenizer.js
// Sentence Splitter + Tokenizer: tách câu và tách từ tiếng Việt theo
// nguyên tắc khớp dài nhất (longest-match) dựa trên từ điển.
// Gắn vào namespace window.VGA.Tokenizer.
// ============================================================

(function (global) {
    "use strict";

    const isPunctuationToken = global.VGA.Utils.isPunctuationToken;

    /**
     * Tách văn bản thành danh sách câu.
     */
    function splitSentences(text) {
        const normalized = text.replace(/\r\n/g, "\n").trim();
        if (!normalized) return [];

        const rawSentences = normalized
            .split(/(?<=[.!?…])\s+|\n+/u)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

        return rawSentences;
    }

    /**
     * Tách 1 câu thành danh sách "đơn vị thô" gồm âm tiết, số và dấu câu.
     * Thứ tự ưu tiên trong regex (quan trọng):
     *   1. Ngày/tháng/năm dạng DD/MM/YYYY hoặc DD-MM-YYYY (ưu tiên khớp trước)
     *   2. Số thập phân: 3.14, 1,5 (dấu chấm/phẩy giữa số)
     *   3. Phần trăm: 99%
     *   4. Số nguyên thuần tuý
     *   5. Từ chữ cái Unicode (có thể kèm dấu gạch ngang khi ghép với số: COVID-19)
     *   6. Dấu câu (mỗi dấu là 1 token riêng)
     */
    function extractRawUnits(sentence) {
        // Dùng regex literal để tránh lỗi escape trong RegExp constructor.
        // Thứ tự ưu tiên rất quan trọng (JS dừng ở nhánh khớp đầu tiên):
        // ngày/tháng > số thập phân > phần trăm > từ+số > số nguyên > từ > dấu câu
        const pattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d+[.,]\d+|\d+%|[\p{L}\p{M}]+(?:[\-][\p{L}\p{M}\d]+)+|\d+|[\p{L}\p{M}]+(?:['\-][\p{L}\p{M}]+)*|[.,!?;:"'…\-()[\]{}]/gu;
        const matches = sentence.match(pattern);
        return matches || [];
    }

    /**
     * Kiểm tra 1 chuỗi có phải là token số (số nguyên, thập phân,
     * phần trăm, ngày/tháng/năm) hay không.
     * @param {string} token
     * @returns {boolean}
     */
    function isNumericToken(token) {
        return /^\d+([.,/\-]\d+)*%?$/.test(token);
    }

    /**
     * Tách 1 câu thành danh sách token (từ) bằng chiến lược khớp dài nhất.
     */
    function tokenizeSentence(sentence, dictionary) {
        const units = extractRawUnits(sentence);
        const tokens = [];
        const maxWindow = Math.max(1, dictionary.maxSyllables);

        let i = 0;
        while (i < units.length) {
            const unit = units[i];

            if (isPunctuationToken(unit)) {
                const posOptions = dictionary.lookupPos(unit) || ["punctuation"];
                tokens.push({ text: unit, posOptions, isPunctuation: true, isOov: false });
                i += 1;
                continue;
            }

            // Token thuần số / ngày tháng / phần trăm -> gán numeral ngay,
            // không cần tra từ điển (sẽ không có trong dictionary.json)
            if (isNumericToken(unit)) {
                const posOptions = (unit.includes("/") || (unit.includes("-") && unit.split("-").length === 3))
                    ? ["determiner", "numeral"]   // ngày/tháng/năm -> thường làm định ngữ thời gian
                    : ["numeral"];
                tokens.push({ text: unit, posOptions, isPunctuation: false, isOov: false });
                i += 1;
                continue;
            }

            let matchedLength = 0;
            let matchedPos = null;

            const remaining = units.length - i;
            const upperBound = Math.min(maxWindow, remaining);

            for (let windowSize = upperBound; windowSize >= 1; windowSize--) {
                const slice = units.slice(i, i + windowSize);
                if (slice.some((u) => isPunctuationToken(u))) continue;

                const candidate = slice.join(" ");
                const pos = dictionary.lookupPos(candidate);
                if (pos) {
                    matchedLength = windowSize;
                    matchedPos = pos;
                    break;
                }
            }

            if (matchedLength > 0) {
                const text = units.slice(i, i + matchedLength).join(" ");
                tokens.push({ text, posOptions: matchedPos, isPunctuation: false, isOov: false });
                i += matchedLength;
            } else {
                tokens.push({ text: unit, posOptions: ["noun"], isPunctuation: false, isOov: true });
                i += 1;
            }
        }

        return tokens;
    }

    /**
     * Tách toàn bộ văn bản thành danh sách câu, mỗi câu đã được tokenize.
     */
    function tokenizeText(text, dictionary) {
        const sentences = splitSentences(text);
        return sentences.map((raw) => ({
            raw,
            tokens: tokenizeSentence(raw, dictionary),
        }));
    }

    global.VGA = global.VGA || {};
    global.VGA.Tokenizer = { splitSentences, tokenizeSentence, tokenizeText };
})(window);
