package categorize

import (
	"testing"

	"github.com/google/uuid"
)

var (
	belanja   = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	transport = uuid.MustParse("00000000-0000-0000-0000-000000000002")
	makanan   = uuid.MustParse("00000000-0000-0000-0000-000000000003")
	gaji      = uuid.MustParse("00000000-0000-0000-0000-000000000004")
	kopiKu    = uuid.MustParse("00000000-0000-0000-0000-000000000005")
)

func systemRules() []Rule {
	return []Rule{
		{Keyword: "indomaret", CategoryID: belanja, Kind: "expense"},
		{Keyword: "grab", CategoryID: transport, Kind: "expense"},
		{Keyword: "grabfood", CategoryID: makanan, Kind: "expense"},
		{Keyword: "kopi", CategoryID: makanan, Kind: "expense"},
		{Keyword: "gaji", CategoryID: gaji, Kind: "income"},
	}
}

func TestNormalize(t *testing.T) {
	cases := map[string]string{
		"  Indomaret, Jl. Sudirman!! ": "indomaret jl sudirman",
		"GoFood-Bakso":                 "gofood bakso",
		"Kopi   Kenangan":              "kopi kenangan",
		"":                             "",
		"Café Ñandú":                   "café ñandú",
	}
	for in, want := range cases {
		if got := Normalize(in); got != want {
			t.Errorf("Normalize(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSuggest(t *testing.T) {
	tests := []struct {
		name     string
		text     string
		kind     string
		rules    []Rule
		wantOK   bool
		wantCat  uuid.UUID
		wantConf float64
	}{
		{"cocok bawaan, abaikan huruf besar dan tanda baca", "INDOMARET - Cabang 12", "", systemRules(), true, belanja, ConfidenceSystem},
		{"awalan kata", "IndomaretPoint", "", systemRules(), true, belanja, ConfidenceSystem},
		{"kata kunci terpanjang menang", "GrabFood nasi goreng", "", systemRules(), true, makanan, ConfidenceSystem},
		{"tidak cocok di tengah kata", "Mekopi", "", systemRules(), false, uuid.Nil, 0},
		{"tanpa kecocokan", "Toko Pak Budi", "", systemRules(), false, uuid.Nil, 0},
		{"teks kosong", "   ", "", systemRules(), false, uuid.Nil, 0},
		{"filter jenis", "gaji september", "expense", systemRules(), false, uuid.Nil, 0},
		{"jenis pemasukan", "Gaji September", "income", systemRules(), true, gaji, ConfidenceSystem},
		{
			"aturan pribadi menang atas bawaan",
			"Kopi Kenangan",
			"",
			append(systemRules(), Rule{Keyword: "kopi kenangan", CategoryID: kopiKu, IsUser: true, Kind: "expense"}),
			true, kopiKu, ConfidenceUser,
		},
		{
			"aturan pribadi menang walau lebih pendek",
			"GrabFood",
			"",
			append(systemRules(), Rule{Keyword: "grab", CategoryID: transport, IsUser: true, Kind: "expense"}),
			true, transport, ConfidenceUser,
		},
		{
			"prioritas lebih tinggi menang",
			"grabfood",
			"",
			[]Rule{
				{Keyword: "grabfood", CategoryID: makanan, Kind: "expense"},
				{Keyword: "grab", CategoryID: transport, Priority: 5, Kind: "expense"},
			},
			true, transport, ConfidenceSystem,
		},
		{
			"kata kunci multi kata",
			"bayar kopi kenangan senopati",
			"",
			[]Rule{{Keyword: "kopi kenangan", CategoryID: kopiKu, IsUser: true, Kind: "expense"}},
			true, kopiKu, ConfidenceUser,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := Suggest(tt.text, tt.kind, tt.rules)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if !ok {
				return
			}
			if got.CategoryID != tt.wantCat || got.Confidence != tt.wantConf {
				t.Fatalf("got %v/%v, want %v/%v", got.CategoryID, got.Confidence, tt.wantCat, tt.wantConf)
			}
		})
	}
}

func TestKeywordFor(t *testing.T) {
	if got := KeywordFor("  Kopi Kenangan!  "); got != "kopi kenangan" {
		t.Fatalf("got %q", got)
	}
	long := ""
	for i := 0; i < 20; i++ {
		long += "abcdé "
	}
	if got := KeywordFor(long); len(got) > MaxKeywordLen || !utf8Valid(got) {
		t.Fatalf("keyword terlalu panjang atau rusak: %q", got)
	}
}
