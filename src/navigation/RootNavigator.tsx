import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../stores/authStore";
import { colors } from "../theme";
import { TabBar } from "./TabBar";
import { Owner } from "../api/endpoints";
import { useLoad } from "../utils/useLoad";

import { OnboardingScreen } from "../screens/boot/OnboardingScreen";
import { WelcomeScreen } from "../screens/boot/WelcomeScreen";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import { ForgotPasswordScreen, ResetPasswordScreen } from "../screens/auth/PasswordResetScreens";
import { ConsentScreen, ForceChangePasswordScreen, LockScreen, SetPinScreen } from "../screens/auth/GateScreens";
import { CmsScreen, ConsentHistoryScreen, HelpScreen, LegalScreen } from "../screens/common/ContentScreens";
import { MessagePreferencesScreen, SignatureScreen } from "../screens/common/SignatureAndPrefsScreens";
import { AccountScreen, EditProfileScreen, NotificationsScreen, PayoutDetailsScreen, SecurityScreen } from "../screens/common/AccountScreens";

import { OwnerDashboardScreen } from "../screens/owner/OwnerDashboardScreen";
import { PropertiesScreen, PropertyDetailScreen, PropertyFormScreen, UnitDetailScreen, UnitFormScreen } from "../screens/owner/PropertyScreens";
import { CreateLeaseScreen, InvitationsScreen, LeaseDetailScreen, LeasesScreen } from "../screens/owner/LeaseScreens";
import { AddUtilityBillScreen } from "../screens/owner/UtilityBillScreen";
import { BillingScreen, CreateInvoiceScreen, OwnerInvoiceScreen, PaymentReviewScreen } from "../screens/owner/BillingScreens";
import { AnnouncementsScreen, MoveOutDetailScreen, MoveOutsScreen, OwnerMaintenanceDetailScreen, OwnerMaintenanceScreen } from "../screens/owner/OpsScreens";

import { TenantHomeScreen } from "../screens/tenant/TenantHomeScreen";
import { PayScreen, PaymentHistoryScreen, TenantInvoiceScreen, TenantInvoicesScreen } from "../screens/tenant/PaymentScreens";
import {
  JoinHomeScreen, MyHomeScreen, NewMaintenanceScreen, NoticesScreen, TenantMaintenanceDetailScreen, TenantMaintenanceScreen, TenantMoveOutScreen,
} from "../screens/tenant/TenantHomeDetailScreens";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const screenOptions = { headerShown: false, animation: "slide_from_right" as const, contentStyle: { backgroundColor: colors.bg } };

const OwnerTabs = () => {
  const pending = useLoad(() => Owner.payments({ status: "PENDING", limit: 50 }), []);
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} />}>
      <Tab.Screen name="Home" component={OwnerDashboardScreen} />
      <Tab.Screen name="PropertiesTab" component={PropertiesScreen} />
      <Tab.Screen name="TenantsTab" component={LeasesScreen} />
      <Tab.Screen name="Billing" component={BillingScreen} options={{ tabBarBadge: pending.data?.length || undefined } as any} />
      <Tab.Screen name="AccountTab" component={AccountScreen} />
    </Tab.Navigator>
  );
};

const TenantTabs = ({ navigation }: any) => (
  <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} onCenter={() => navigation.navigate("Pay")} />}>
    <Tab.Screen name="HomeTab" component={TenantHomeScreen} />
    <Tab.Screen name="MyHomeTab" component={MyHomeScreen} />
    <Tab.Screen name="PayTab" component={TenantHomeScreen} />
    <Tab.Screen name="RequestsTab" component={TenantMaintenanceScreen} />
    <Tab.Screen name="AccountTab" component={AccountScreen} />
  </Tab.Navigator>
);

const commonScreens = (
  <>
    <Stack.Screen name="Legal" component={LegalScreen} />
    <Stack.Screen name="Cms" component={CmsScreen} />
    <Stack.Screen name="Help" component={HelpScreen} />
    <Stack.Screen name="Consents" component={ConsentHistoryScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    <Stack.Screen name="Security" component={SecurityScreen} />
    <Stack.Screen name="MessagePreferences" component={MessagePreferencesScreen} />
    <Stack.Screen name="Signature" component={SignatureScreen} options={{ animation: "slide_from_bottom" }} />
  </>
);

export const RootNavigator = () => {
  const { status, user, requirements, onboardingSeen, returningUser } = useAuth();
  if (status === "booting") return null;

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {status === "signedOut" ? (
        <>
          {/* First run: onboarding → welcome. Returning users (signed in before on this device) land on Login. */}
          {returningUser ? (
            <Stack.Screen name="Login" component={LoginScreen} options={{ animation: "fade" }} />
          ) : (
            <>
              {!onboardingSeen && <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: "fade" }} />}
              <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ animation: "fade" }} />
              <Stack.Screen name="Login" component={LoginScreen} />
            </>
          )}
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Forgot" component={ForgotPasswordScreen} />
          <Stack.Screen name="Reset" component={ResetPasswordScreen} />
          <Stack.Screen name="Legal" component={LegalScreen} options={{ animation: "slide_from_bottom" }} />
        </>
      ) : status === "locked" ? (
        <Stack.Screen name="Lock" component={LockScreen} options={{ animation: "fade" }} />
      ) : requirements.must_set_pin || (requirements.must_change_password && user?.role !== "ADMIN") ? (
        <Stack.Screen name="SetPin" component={SetPinScreen} options={{ animation: "fade" }} />
      ) : requirements.must_change_password ? (
        <Stack.Screen name="ForceChangePassword" component={ForceChangePasswordScreen} options={{ animation: "fade" }} />
      ) : requirements.pending_consents.length ? (
        <>
          <Stack.Screen name="Consent" component={ConsentScreen} options={{ animation: "fade" }} />
          <Stack.Screen name="Legal" component={LegalScreen} options={{ animation: "slide_from_bottom" }} />
        </>
      ) : user?.role === "OWNER" ? (
        <>
          <Stack.Screen name="OwnerTabs" component={OwnerTabs} options={{ animation: "fade" }} />
          <Stack.Screen name="PropertyDetail" component={PropertyDetailScreen} />
          <Stack.Screen name="PropertyForm" component={PropertyFormScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="UnitForm" component={UnitFormScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="UnitDetail" component={UnitDetailScreen} />
          <Stack.Screen name="CreateLease" component={CreateLeaseScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="LeaseDetail" component={LeaseDetailScreen} />
          <Stack.Screen name="Invitations" component={InvitationsScreen} />
          <Stack.Screen name="AddUtilityBill" component={AddUtilityBillScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="OwnerInvoice" component={OwnerInvoiceScreen} />
          <Stack.Screen name="CreateInvoice" component={CreateInvoiceScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="PaymentReview" component={PaymentReviewScreen} />
          <Stack.Screen name="MoveOuts" component={MoveOutsScreen} />
          <Stack.Screen name="MoveOutDetail" component={MoveOutDetailScreen} />
          <Stack.Screen name="Maintenance" component={OwnerMaintenanceScreen} />
          <Stack.Screen name="OwnerMaintenanceDetail" component={OwnerMaintenanceDetailScreen} />
          <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
          <Stack.Screen name="PayoutDetails" component={PayoutDetailsScreen} />
          {commonScreens}
        </>
      ) : (
        <>
          <Stack.Screen name="TenantTabs" component={TenantTabs} options={{ animation: "fade" }} />
          <Stack.Screen name="Pay" component={PayScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="TenantInvoices" component={TenantInvoicesScreen} />
          <Stack.Screen name="TenantInvoice" component={TenantInvoiceScreen} />
          <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
          <Stack.Screen name="NewMaintenance" component={NewMaintenanceScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="TenantMaintenanceDetail" component={TenantMaintenanceDetailScreen} />
          <Stack.Screen name="MoveOut" component={TenantMoveOutScreen} />
          <Stack.Screen name="Notices" component={NoticesScreen} />
          <Stack.Screen name="JoinHome" component={JoinHomeScreen} />
          {commonScreens}
        </>
      )}
    </Stack.Navigator>
  );
};
