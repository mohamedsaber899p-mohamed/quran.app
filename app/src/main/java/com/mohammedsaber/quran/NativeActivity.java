package com.mohammedsaber.quran;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import android.text.Editable;
import android.text.TextWatcher;
import org.json.*;
import java.net.*;
import java.io.*;
import java.util.*;

public class NativeActivity extends Activity {

    private final int BG = Color.rgb(5, 20, 17);
    private final int CARD = Color.rgb(13, 43, 35);
    private final int GREEN = Color.rgb(16, 105, 76);
    private final int GOLD = Color.rgb(221, 181, 99);
    private final int WHITE = Color.rgb(245, 243, 231);

    private LinearLayout root, content;
    private EditText search;
    private JSONArray surahs = new JSONArray();
    private String currentSurah = "";
    private int currentNumber = 0;
    private android.content.SharedPreferences prefs;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);

        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(Color.BLACK);

        prefs = getSharedPreferences("quran_native", MODE_PRIVATE);
        showHome();
        loadSurahs();
    }

    private GradientDrawable shape(int color, int radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(radius);
        return d;
    }

    private TextView text(String value, int size, int color) {
        TextView t = new TextView(this);
        t.setText(value);
        t.setTextSize(size);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        t.setPadding(14, 12, 14, 12);
        return t;
    }

    private TextView button(String value, Runnable action) {
        TextView b = text(value, 15, WHITE);
        b.setGravity(Gravity.CENTER);
        b.setBackground(shape(GREEN, 22));
        b.setOnClickListener(v -> action.run());
        return b;
    }

    private LinearLayout column() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }

    private LinearLayout.LayoutParams params(int height) {
        return new LinearLayout.LayoutParams(
            -1, height
        );
    }

    private void base(String title) {
        root = column();
        root.setBackgroundColor(BG);
        root.setPadding(18, 12, 18, 8);

        TextView heading = text("☾  " + title, 23, GOLD);
        heading.setTypeface(null, Typeface.BOLD);
        root.addView(heading, params(58));

        setContentView(root);
    }

    private void showHome() {
        base("المصحف الإلكتروني");

        TextView intro = text(
            "بسم الله الرحمن الرحيم\nرفيقك اليومي لقراءة القرآن الكريم",
            17, WHITE
        );
        intro.setGravity(Gravity.CENTER);
        intro.setBackground(shape(CARD, 24));
        root.addView(intro, params(105));

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setPadding(0, 12, 0, 12);

        TextView last = button("▶  متابعة القراءة", () -> {
            int n = prefs.getInt("last_surah", 1);
            openSurah(n);
        });
        actions.addView(last, new LinearLayout.LayoutParams(0, 54, 1));

        TextView saved = button("★  العلامات", this::showBookmarks);
        LinearLayout.LayoutParams sp =
            new LinearLayout.LayoutParams(0, 54, 1);
        sp.setMargins(8, 0, 0, 0);
        actions.addView(saved, sp);
        root.addView(actions);

        TextView label = text("فهرس السور", 20, GOLD);
        label.setTypeface(null, Typeface.BOLD);
        root.addView(label);

        search = new EditText(this);
        search.setSingleLine(true);
        search.setTextColor(WHITE);
        search.setHintTextColor(Color.LTGRAY);
        search.setHint("ابحث باسم السورة أو رقمها...");
        search.setPadding(18, 8, 18, 8);
        search.setBackground(shape(CARD, 18));
        root.addView(search, params(52));

        ScrollView scroll = new ScrollView(this);
        content = column();
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));

        search.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s,int st,int c,int a) {}
            public void onTextChanged(CharSequence s,int st,int before,int count) {
                renderSurahs(s.toString());
            }
            public void afterTextChanged(Editable e) {}
        });

        renderSurahs("");
    }

    private void loadSurahs() {
        new Thread(() -> {
            try {
                JSONObject response = request(
                    "https://api.alquran.cloud/v1/surah"
                );
                JSONArray data = response.getJSONArray("data");
                runOnUiThread(() -> {
                    surahs = data;
                    renderSurahs(search == null ? "" : search.getText().toString());
                });
            } catch (Exception e) {
                runOnUiThread(() ->
                    Toast.makeText(this,
                        "تعذر تحميل الفهرس. تحقق من الإنترنت.",
                        Toast.LENGTH_LONG).show()
                );
            }
        }).start();
    }

    private void renderSurahs(String query) {
        if (content == null) return;
        content.removeAllViews();

        String q = query.trim().toLowerCase(Locale.ROOT);

        for (int i = 0; i < surahs.length(); i++) {
            JSONObject s = surahs.optJSONObject(i);
            if (s == null) continue;

            int number = s.optInt("number");
            String name = s.optString("name");
            String english = s.optString("englishName");
            String type = s.optString("revelationType");
            int count = s.optInt("numberOfAyahs");

            if (!q.isEmpty()
                && !name.contains(q)
                && !english.toLowerCase(Locale.ROOT).contains(q)
                && !String.valueOf(number).contains(q)) continue;

            LinearLayout card = new LinearLayout(this);
            card.setGravity(Gravity.CENTER_VERTICAL);
            card.setPadding(8, 5, 8, 5);
            card.setBackground(shape(CARD, 18));

            TextView numberView = text(
                String.valueOf(number), 17, GOLD
            );
            numberView.setGravity(Gravity.CENTER);
            card.addView(numberView, new LinearLayout.LayoutParams(48, 65));

            LinearLayout details = column();
            TextView nameView = text(name, 19, WHITE);
            nameView.setTypeface(null, Typeface.BOLD);
            details.addView(nameView);

            details.addView(text(
                english + "  •  " + count + " آية",
                12, Color.LTGRAY
            ));
            card.addView(details, new LinearLayout.LayoutParams(0, -2, 1));

            TextView typeView = text(
                type.equals("Meccan") ? "مكية" : "مدنية",
                12, GOLD
            );
            card.addView(typeView);

            card.setOnClickListener(v -> openSurah(number));

            LinearLayout.LayoutParams cp =
                new LinearLayout.LayoutParams(-1, -2);
            cp.setMargins(0, 7, 0, 2);
            content.addView(card, cp);
        }
    }

    private void openSurah(int number) {
        currentNumber = number;
        prefs.edit().putInt("last_surah", number).apply();

        base("جاري تحميل السورة...");

        new Thread(() -> {
            try {
                JSONObject response = request(
                    "https://api.alquran.cloud/v1/surah/" + number
                );
                JSONObject data = response.getJSONObject("data");
                JSONArray ayahs = data.getJSONArray("ayahs");
                String name = data.getString("name");

                runOnUiThread(() -> showReading(name, ayahs));
            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(this,
                        "تعذر تحميل السورة", Toast.LENGTH_SHORT).show();
                    showHome();
                });
            }
        }).start();
    }

    private void showReading(String name, JSONArray ayahs) {
        currentSurah = name;
        base(name);

        TextView info = text(
            "سورة " + name + "  •  " + ayahs.length() + " آية",
            15, GOLD
        );
        root.addView(info);

        LinearLayout tools = new LinearLayout(this);
        tools.setOrientation(LinearLayout.HORIZONTAL);

        TextView home = button("الفهرس", this::showHome);
        tools.addView(home, new LinearLayout.LayoutParams(0, 48, 1));

        TextView bookmark = button("★ حفظ علامة", () -> {
            Set<String> saved = new HashSet<>(
                prefs.getStringSet("bookmarks", new HashSet<>())
            );
            saved.add(currentNumber + "");
            prefs.edit().putStringSet("bookmarks", saved).apply();
            Toast.makeText(this, "تم حفظ السورة في العلامات",
                Toast.LENGTH_SHORT).show();
        });
        LinearLayout.LayoutParams bp =
            new LinearLayout.LayoutParams(0, 48, 1);
        bp.setMargins(8, 0, 0, 0);
        tools.addView(bookmark, bp);
        root.addView(tools);

        ScrollView scroll = new ScrollView(this);
        LinearLayout verses = column();

        for (int i = 0; i < ayahs.length(); i++) {
            JSONObject a = ayahs.optJSONObject(i);
            if (a == null) continue;

            TextView verse = text(
                a.optString("text") + "  ۞ " + a.optInt("numberInSurah"),
                23, WHITE
            );
            verse.setGravity(Gravity.RIGHT);
            verse.setPadding(12, 18, 12, 18);
            verse.setLineSpacing(12, 1.2f);
            verse.setBackground(shape(CARD, 16));

            LinearLayout.LayoutParams vp =
                new LinearLayout.LayoutParams(-1, -2);
            vp.setMargins(0, 8, 0, 4);
            verses.addView(verse, vp);
        }

        scroll.addView(verses);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    }

    private void showBookmarks() {
        base("السور المحفوظة");

        TextView back = button("العودة للفهرس", this::showHome);
        root.addView(back, params(48));

        ScrollView scroll = new ScrollView(this);
        LinearLayout list = column();
        scroll.addView(list);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));

        Set<String> saved =
            prefs.getStringSet("bookmarks", new HashSet<>());

        for (String value : saved) {
            try {
                int n = Integer.parseInt(value);
                TextView item = button(
                    "سورة رقم " + n, () -> openSurah(n)
                );
                LinearLayout.LayoutParams p =
                    new LinearLayout.LayoutParams(-1, 55);
                p.setMargins(0, 7, 0, 0);
                list.addView(item, p);
            } catch (Exception ignored) {}
        }

        if (saved.isEmpty()) {
            list.addView(text(
                "لم تحفظ أي سورة بعد.", 17, WHITE
            ));
        }
    }

    private JSONObject request(String address) throws Exception {
        HttpURLConnection c = (HttpURLConnection)
            new URL(address).openConnection();
        c.setRequestMethod("GET");
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);

        try {
            BufferedReader r = new BufferedReader(
                new InputStreamReader(c.getInputStream(), "UTF-8")
            );
            StringBuilder result = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) result.append(line);
            r.close();
            return new JSONObject(result.toString());
        } finally {
            c.disconnect();
        }
    }

    @Override
    public void onBackPressed() {
        if (currentNumber != 0) {
            currentNumber = 0;
            showHome();
        } else {
            super.onBackPressed();
        }
    }
}
