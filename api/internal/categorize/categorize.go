// Package categorize menyarankan kategori dari nama merchant atau catatan
// berdasarkan aturan kata kunci (PRD bagian 10, F-04).
package categorize

import (
	"strings"
	"unicode"

	"github.com/google/uuid"
)

// Confidence untuk aturan pribadi dan aturan bawaan.
const (
	ConfidenceUser   = 1.0
	ConfidenceSystem = 0.8
)

// MaxKeywordLen membatasi panjang kata kunci aturan pribadi.
const MaxKeywordLen = 60

// Rule adalah satu aturan kata kunci → kategori.
type Rule struct {
	Keyword    string
	CategoryID uuid.UUID
	Priority   int32
	IsUser     bool   // true = aturan pribadi pengguna
	Kind       string // expense | income (jenis kategori tujuan)
}

// Suggestion adalah hasil saran kategori.
type Suggestion struct {
	CategoryID uuid.UUID
	Confidence float64
	Rule       Rule
}

// Normalize merapikan teks: huruf kecil, tanda baca jadi spasi, spasi dirapikan.
func Normalize(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range strings.ToLower(s) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		} else {
			b.WriteRune(' ')
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

// KeywordFor membuat kata kunci aturan pribadi dari teks merchant.
func KeywordFor(merchant string) string {
	k := Normalize(merchant)
	if len(k) > MaxKeywordLen {
		k = strings.TrimSpace(k[:MaxKeywordLen])
		// Jangan memotong di tengah karakter multibyte.
		for len(k) > 0 && !utf8Valid(k) {
			k = k[:len(k)-1]
		}
	}
	return k
}

// Suggest mencari aturan yang cocok dengan teks. Aturan pribadi selalu menang
// atas aturan bawaan; di dalam kelompok yang sama dipilih prioritas tertinggi,
// lalu kata kunci terpanjang. kind kosong = semua jenis.
func Suggest(text, kind string, rules []Rule) (Suggestion, bool) {
	tokens := strings.Fields(Normalize(text))
	if len(tokens) == 0 {
		return Suggestion{}, false
	}

	var best *Rule
	for i := range rules {
		r := &rules[i]
		if kind != "" && r.Kind != kind {
			continue
		}
		kw := strings.Fields(Normalize(r.Keyword))
		if len(kw) == 0 || !matches(tokens, kw) {
			continue
		}
		if best == nil || better(r, best) {
			best = r
		}
	}
	if best == nil {
		return Suggestion{}, false
	}
	conf := ConfidenceSystem
	if best.IsUser {
		conf = ConfidenceUser
	}
	return Suggestion{CategoryID: best.CategoryID, Confidence: conf, Rule: *best}, true
}

func better(a, b *Rule) bool {
	if a.IsUser != b.IsUser {
		return a.IsUser
	}
	if a.Priority != b.Priority {
		return a.Priority > b.Priority
	}
	la, lb := len(Normalize(a.Keyword)), len(Normalize(b.Keyword))
	if la != lb {
		return la > lb
	}
	return a.Keyword < b.Keyword // stabil
}

// matches: urutan token kata kunci muncul berurutan di teks. Semua token harus
// sama persis kecuali token terakhir yang boleh berupa awalan kata
// ("indomaret" cocok dengan "indomaretpoint").
func matches(text, kw []string) bool {
	for start := 0; start+len(kw) <= len(text); start++ {
		ok := true
		for j, k := range kw {
			t := text[start+j]
			if j == len(kw)-1 {
				ok = strings.HasPrefix(t, k)
			} else {
				ok = t == k
			}
			if !ok {
				break
			}
		}
		if ok {
			return true
		}
	}
	return false
}

func utf8Valid(s string) bool {
	return strings.ToValidUTF8(s, "�") == s
}
