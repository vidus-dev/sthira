import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../auth/AuthContext";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { AccountsScreen } from "../screens/AccountsScreen";
import { TransactionsScreen } from "../screens/TransactionsScreen";
import { BudgetsScreen } from "../screens/BudgetsScreen";
import { GoalsScreen } from "../screens/GoalsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Accounts: undefined;
  Transactions: undefined;
  Budgets: undefined;
  Goals: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#0f172a",
        tabBarInactiveTintColor: "#64748b",
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Home" }} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Budgets" component={BudgetsScreen} />
      <Tab.Screen name="Goals" component={GoalsScreen} options={{ title: "Goals" }} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { isHydrated, isAuthenticated } = useAuth();

  if (!isHydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator
      key={isAuthenticated ? "app" : "auth"}
      screenOptions={{ headerShown: false }}
    >
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  muted: { marginTop: 8, color: "#64748b", fontSize: 14 },
});
