'use client';

import Image from 'next/image';
import Link from 'next/link';
import Logo from '../../assets/iibs_logo.png';
import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../../../../firebaseConfig'; 
import { useRouter } from 'next/navigation';

export default function RenderNav() {
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push('auth/login'); 
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <nav className="navbar navbar-expand-lg bg-white border-bottom px-4 py-2">
            <div className="container-fluid">
                <Link href="/" className="navbar-brand">
                    <Image 
                        src={Logo}
                        alt="IIBS Logo"
                        width={100}
                        height={50}
                        className="me-3 img-fluid"
                    />
                </Link>
                <div className="collapse navbar-collapse justify-content-end">
                    <ul className="navbar-nav">
                        <li className="nav-item">
                            <Link href="/home" className="nav-link">Dashboard</Link>
                        </li>
                        <li className="nav-item">
                            <Link href="./roles" className="nav-link">Rôles</Link>
                        </li>
                        <li className="nav-item">
                            <Link href="/modules" className="nav-link">Modules</Link>
                        </li>
                        <li className="nav-item">
                            <Link href="/teachers" className="nav-link">Teachers</Link>
                        </li>
                        <li className="nav-item">
                            <Link href="/as" className="nav-link">
                                <Image 
                                    src={Logo}
                                    alt="Profile"
                                    width={32}
                                    height={35}
                                    className="rounded-circle"
                                />
                            </Link>
                        </li>
                    </ul>
                </div>
                <div>
                    <button 
                        onClick={handleLogout} 
                        className="btn btn-outline-danger fw-semibold"
                    >
                        Déconnexion
                    </button>
                </div>
            </div>
        </nav>
    );
}
