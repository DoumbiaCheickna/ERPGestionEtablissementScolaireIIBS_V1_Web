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
        try { await signOut(auth); router.push('/admin/auth/login'); } 
        catch (e) { console.error(e); }
    };

     return (
        <nav className="navbar navbar-expand-lg bg-white border-bottom px-4 py-2">
        <div className="container-fluid">
            <Link href="/admin/home" className="navbar-brand">
            <Image src={Logo} alt="IIBS Logo" width={100} height={50} className="img-fluid" />
            </Link>

            <div className="collapse navbar-collapse justify-content-end">
            <ul className="navbar-nav">
                <li className="nav-item">
                {/* Rôles doit emmener “là où on a Role Management” → ta page roles */}
                <Link href="/admin/pages/roles" className="nav-link">Rôles</Link>
                </li>
            </ul>
            </div>

            <div>
            <button onClick={handleLogout} className="btn btn-outline-danger fw-semibold">
                Déconnexion
            </button>
            </div>
        </div>
        </nav>
    );
}
