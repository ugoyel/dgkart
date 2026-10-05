# Razorpay checkout
-keepattributes *Annotation*
-dontwarn com.razorpay.**
-keep class com.razorpay.** { *; }
-optimizations !method/inlining/
-keepclasseswithmembers class * {
  public void onPayment*(...);
}
# Google Play services / Firebase (SafetyNet / Play Integrity used by Phone Auth)
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
