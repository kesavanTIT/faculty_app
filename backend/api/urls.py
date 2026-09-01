from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('forgot-password/', views.forgot_password_view, name='forgot-password'),
    path('profile/', views.profile_view, name='profile'),
    path('vacancies/', views.vacancy_view, name='vacancies'),
    path('apply/', views.apply_job_view, name='apply'),
    path('admin/applications/', views.admin_applications_view, name='admin-applications'),
    path('admin/schedule-interview/', views.schedule_interview_view, name='schedule-interview'),
    path('admin/stats/', views.admin_stats_view, name='admin-stats'),
    path('notifications/', views.notifications_view, name='notifications'),
]
