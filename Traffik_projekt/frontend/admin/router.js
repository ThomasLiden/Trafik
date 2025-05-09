import adminLogin from "./components/adminLogin.js"; 
import adminHome from "./components/adminHome.js";
import adminPricing from "./components/adminPricing.js";
import administration from "./components/administration.js";
import adminAccount from "./components/adminAccount.js";
import adminSubscriptions from "./components/adminSubscriptions.js";



const routes = [
    { path: '/', redirect: '/admin/login' },
    { path: '/admin/login', component: adminLogin },
    { path: '/admin', component: adminHome },
    { path: '/admin/subscriptions', component: adminSubscriptions },
    { path: '/admin/pricing', component: adminPricing },
    { path: '/admin/account', component: adminAccount},
    { path: '/admin/administration', component: administration },      
];

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes
});


 router.beforeEach((to, from, next) => {
    const userRole = localStorage.getItem("user_role");
    const resellerId = localStorage.getItem("reseller_id");
    console.log(resellerId);
    console.log(userRole);

    if (!userRole && to.path !== '/admin/login') {
        return next('/admin/login');  // om ingen är inloggad redirecta till login
    }

    if (to.path === '/admin/administration' && userRole !== 'superadmin') {
        return next('/admin');
    }

    next(); 
});


export default router;