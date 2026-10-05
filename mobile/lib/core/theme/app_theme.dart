import 'package:flutter/material.dart';

/// DGkart brand palette. A marketplace look (white canvas, blue actions, pill
/// buttons, dense listings) with DGkart's own colours and logo.
class DkColors {
  static const primary = Color(0xFF1A56DB); // actions, links
  static const primaryDark = Color(0xFF0B3BA8);
  static const accent = Color(0xFFF97316); // brand orange (logo "Kart")
  static const navy = Color(0xFF0F1E3D); // brand navy (logo "DG")
  static const deal = Color(0xFFD7263D); // discount / deal red
  static const success = Color(0xFF138A36);
  static const text = Color(0xFF191919);
  static const textMuted = Color(0xFF707070);
  static const divider = Color(0xFFE5E5E5);
  static const surface = Color(0xFFF7F7F7);
  static const star = Color(0xFFF5A623);
}

const _font = 'Inter';

class AppTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: DkColors.primary,
      primary: DkColors.primary,
      secondary: DkColors.accent,
      surface: Colors.white,
      brightness: Brightness.light,
    );
    const pill = StadiumBorder();
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: Colors.white,
      dividerColor: DkColors.divider,
      fontFamily: _font,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: DkColors.text,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: _font, color: DkColors.text, fontSize: 18, fontWeight: FontWeight.w600),
      ),
      textTheme: const TextTheme(
        headlineSmall: TextStyle(fontFamily: _font, fontWeight: FontWeight.w700, color: DkColors.text),
        titleLarge: TextStyle(fontFamily: _font, fontWeight: FontWeight.w700, color: DkColors.text),
        titleMedium: TextStyle(fontFamily: _font, fontWeight: FontWeight.w600, color: DkColors.text),
        bodyMedium: TextStyle(fontFamily: _font, color: DkColors.text),
        bodySmall: TextStyle(fontFamily: _font, color: DkColors.textMuted),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: DkColors.primary,
          shape: pill,
          minimumSize: const Size.fromHeight(48),
          textStyle: const TextStyle(fontFamily: _font, fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: DkColors.primary,
          side: const BorderSide(color: DkColors.primary),
          shape: pill,
          minimumSize: const Size.fromHeight(48),
          textStyle: const TextStyle(fontFamily: _font, fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      chipTheme: ChipThemeData(
        shape: const StadiumBorder(side: BorderSide(color: DkColors.divider)),
        backgroundColor: Colors.white,
        selectedColor: DkColors.navy,
        labelStyle: const TextStyle(fontFamily: _font, color: DkColors.text, fontSize: 13),
        secondaryLabelStyle: const TextStyle(fontFamily: _font, color: Colors.white),
        side: const BorderSide(color: DkColors.divider),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: DkColors.primary.withValues(alpha: 0.10),
        labelTextStyle: WidgetStateProperty.all(const TextStyle(fontFamily: _font, fontSize: 11, fontWeight: FontWeight.w500)),
        height: 64,
      ),
      snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    );
  }
}
