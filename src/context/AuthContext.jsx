import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchUserProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*, user_roles(role_name)')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching profile:', error);
            }

            setUserProfile(data);
        } catch (err) {
            console.error('Error in fetchUserProfile:', err);
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    const signUp = async (email, password, firstName, lastName, roleName) => {
        // First grab the role ID
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('id')
            .eq('role_name', roleName)
            .single();

        if (!roleData) throw new Error('Rol no válido');

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) throw error;

        if (data?.user) {
            // Create profile
            await supabase.from('user_profiles').insert([
                {
                    id: data.user.id,
                    first_name: firstName,
                    last_name: lastName,
                    role_id: roleData.id
                }
            ]);
        }

        return data;
    };

    const signOut = async () => {
        return supabase.auth.signOut();
    };

    const refreshProfile = async () => {
        if (session?.user?.id) {
            await fetchUserProfile(session.user.id);
        }
    };

    const value = {
        session,
        userProfile,
        loading,
        role: userProfile?.user_roles?.role_name || null,
        signIn,
        signUp,
        signOut,
        refreshProfile
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
