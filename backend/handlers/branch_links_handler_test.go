package handlers

import "testing"

func TestNormalizeWhatsapp(t *testing.T) {
	cases := []struct {
		in   string
		want string
		ok   bool
	}{
		{"", "", true},
		{"+56 9 1234 5678", "56912345678", true},
		{"912345678", "56912345678", true},
		{"(+54) 11 2345-6789", "541123456789", true},
		{"1234", "", false},
		{"1234567890123456", "", false},
	}
	for _, c := range cases {
		got, ok := normalizeWhatsapp(c.in)
		if got != c.want || ok != c.ok {
			t.Errorf("normalizeWhatsapp(%q) = %q, %v; want %q, %v", c.in, got, ok, c.want, c.ok)
		}
	}
}

func TestNormalizeWebsite(t *testing.T) {
	cases := []struct {
		in   string
		want string
		ok   bool
	}{
		{"", "", true},
		{"minegocio.cl", "https://minegocio.cl", true},
		{" http://minegocio.cl/carta ", "http://minegocio.cl/carta", true},
		{"javascript:alert(1)", "", false},
		{"ftp://minegocio.cl", "", false},
		{"localhost", "", false},
	}
	for _, c := range cases {
		got, ok := normalizeWebsite(c.in)
		if got != c.want || ok != c.ok {
			t.Errorf("normalizeWebsite(%q) = %q, %v; want %q, %v", c.in, got, ok, c.want, c.ok)
		}
	}
}
