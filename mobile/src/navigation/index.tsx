import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { storage } from '../services/storage';
import { useTheme } from '../theme/ThemeContext';

import { ScanScreen } from '../screens/ScanScreen';
import { JoinScreen } from '../screens/JoinScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { WaitingScreen } from '../screens/WaitingScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { GalleryScreen } from '../screens/GalleryScreen';
import { LiveScreen } from '../screens/LiveScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

import { Camera, Radio, Image as ImageIcon, User } from 'lucide-react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontSize: 17,
          fontWeight: '700',
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="CameraTab"
        component={CameraScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Camera',
          tabBarIcon: ({ color, size }) => <Camera size={size || 22} color={color} />,
        }}
      />
      <Tab.Screen
        name="LiveTab"
        component={LiveScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Live',
          tabBarIcon: ({ color, size }) => <Radio size={size || 22} color={color} />,
        }}
      />
      <Tab.Screen
        name="GalleryTab"
        component={GalleryScreen}
        options={{
          title: 'Event Gallery',
          tabBarLabel: 'Gallery',
          tabBarIcon: ({ color, size }) => <ImageIcon size={size || 22} color={color} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'My Profile',
          tabBarLabel: 'Me',
          tabBarIcon: ({ color, size }) => <User size={size || 22} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { colors } = useTheme();
  const [initialRoute, setInitialRoute] = useState<string>('Scan');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function determineRoute() {
      try {
        const guest = await storage.getGuest();
        if (guest) {
          if (guest.status === 'pending') {
            setInitialRoute('Waiting');
          } else {
            setInitialRoute('MainTabs');
          }
        } else {
          setInitialRoute('Scan');
        }
      } catch (err) {
        console.warn('Failed to load guest state:', err);
      } finally {
        setIsReady(true);
      }
    }
    determineRoute();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="Join" component={JoinScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Waiting" component={WaitingScreen} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
