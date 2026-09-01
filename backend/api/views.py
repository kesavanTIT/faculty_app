import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from .models import UserProfile, FacultyProfile, JobVacancy, JobApplication, Interview, Notification
from django.utils import timezone
from datetime import datetime

# Helper function to get user from custom auth header
def get_user_from_request(request):
    user_id = request.headers.get('X-User-Id')
    if user_id:
        return User.objects.filter(id=user_id).first()
    return None

# Helper to check if user is admin
def is_admin(user):
    if not user:
        return False
    profile = UserProfile.objects.filter(user=user).first()
    return profile and profile.role == 'admin'

@csrf_exempt
def register_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request method'}, status=405)
    
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')
        full_name = data.get('full_name', 'Faculty User')
        
        if not email or not password:
            return JsonResponse({'error': 'Email and Password are required'}, status=400)
            
        if User.objects.filter(username=email).exists():
            return JsonResponse({'error': 'Email is already registered'}, status=400)
            
        # Create standard User
        user = User.objects.create_user(username=email, email=email, password=password)
        
        # Link role
        UserProfile.objects.create(user=user, role='faculty')
        
        # Link faculty profile
        FacultyProfile.objects.create(
            user=user, 
            full_name=full_name,
            phone='',
            qualification='',
            experience='',
            skills=''
        )
        
        # Welcome notification
        Notification.objects.create(
            user=user,
            title="Registration Successful",
            message="Welcome to the College Faculty Recruitment System! Please update your profile to apply for jobs."
        )
        
        return JsonResponse({'success': True, 'message': 'Registration successful'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def login_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request method'}, status=405)
        
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return JsonResponse({'error': 'Email and Password are required'}, status=400)
            
        user = authenticate(username=email, password=password)
        
        if user is not None:
            profile, created = UserProfile.objects.get_or_create(user=user, defaults={'role': 'faculty'})
            return JsonResponse({
                'success': True,
                'user_id': user.id,
                'email': user.email,
                'role': profile.role
            })
        else:
            return JsonResponse({'error': 'Invalid email or password'}, status=401)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def forgot_password_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request method'}, status=405)
        
    try:
        data = json.loads(request.body)
        email = data.get('email')
        
        user = User.objects.filter(username=email).first()
        if user:
            # In production, we'd send an email. For demo/dev ease, we just return a success message.
            return JsonResponse({
                'success': True, 
                'message': 'Password recovery message has been simulated. For testing purposes, you can login with your register credentials or contact admin.'
            })
        else:
            return JsonResponse({'error': 'User with this email does not exist.'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def profile_view(request):
    user = get_user_from_request(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    profile, created = FacultyProfile.objects.get_or_create(user=user)
    
    if request.method == 'GET':
        return JsonResponse({
            'full_name': profile.full_name,
            'phone': profile.phone,
            'dob': str(profile.dob) if profile.dob else '',
            'gender': profile.gender,
            'qualification': profile.qualification,
            'experience': profile.experience,
            'skills': profile.skills,
            'resume_url': profile.resume_url.url if profile.resume_url else ''
        })
        
    elif request.method == 'POST':
        try:
            # We can receive either multipart form-data or JSON
            if request.content_type.startswith('multipart/form-data'):
                profile.full_name = request.POST.get('full_name', profile.full_name)
                profile.phone = request.POST.get('phone', profile.phone)
                dob_str = request.POST.get('dob')
                if dob_str:
                    try:
                        profile.dob = datetime.strptime(dob_str, '%Y-%m-%d').date()
                    except ValueError:
                        pass
                profile.gender = request.POST.get('gender', profile.gender)
                profile.qualification = request.POST.get('qualification', profile.qualification)
                profile.experience = request.POST.get('experience', profile.experience)
                profile.skills = request.POST.get('skills', profile.skills)
                
                if 'resume' in request.FILES:
                    profile.resume_url = request.FILES['resume']
            else:
                data = json.loads(request.body)
                profile.full_name = data.get('full_name', profile.full_name)
                profile.phone = data.get('phone', profile.phone)
                dob_str = data.get('dob')
                if dob_str:
                    try:
                        profile.dob = datetime.strptime(dob_str, '%Y-%m-%d').date()
                    except ValueError:
                        pass
                profile.gender = data.get('gender', profile.gender)
                profile.qualification = data.get('qualification', profile.qualification)
                profile.experience = data.get('experience', profile.experience)
                profile.skills = data.get('skills', profile.skills)

                
            profile.save()
            return JsonResponse({'success': True, 'message': 'Profile updated successfully'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
            
    return JsonResponse({'error': 'Invalid request method'}, status=405)

@csrf_exempt
def vacancy_view(request):
    if request.method == 'GET':
        vacancies = JobVacancy.objects.all().order_by('-created_at')
        list_data = []
        for v in vacancies:
            list_data.append({
                'id': v.id,
                'title': v.title,
                'department': v.department,
                'qualification_required': v.qualification_required,
                'experience_required': v.experience_required,
                'description': v.description,
                'status': v.status,
                'created_at': v.created_at.strftime('%Y-%m-%d')
            })
        return JsonResponse(list_data, safe=False)
        
    elif request.method == 'POST':
        user = get_user_from_request(request)
        if not is_admin(user):
            return JsonResponse({'error': 'Unauthorized: Admin access required'}, status=403)
            
        try:
            data = json.loads(request.body)
            title = data.get('title')
            department = data.get('department')
            qualification_required = data.get('qualification_required')
            experience_required = data.get('experience_required')
            description = data.get('description')
            
            if not all([title, department, qualification_required, experience_required, description]):
                return JsonResponse({'error': 'All fields are required'}, status=400)
                
            vacancy = JobVacancy.objects.create(
                title=title,
                department=department,
                qualification_required=qualification_required,
                experience_required=experience_required,
                description=description
            )
            return JsonResponse({
                'success': True, 
                'message': 'Job vacancy added successfully',
                'id': vacancy.id
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
            
    elif request.method in ['PUT', 'PATCH']:
        user = get_user_from_request(request)
        if not is_admin(user):
            return JsonResponse({'error': 'Unauthorized: Admin access required'}, status=403)
            
        try:
            data = json.loads(request.body)
            job_id = data.get('id')
            if not job_id:
                return JsonResponse({'error': 'Job ID required'}, status=400)
                
            vacancy = get_object_or_404(JobVacancy, id=job_id)
            if 'title' in data: vacancy.title = data['title']
            if 'department' in data: vacancy.department = data['department']
            if 'qualification_required' in data: vacancy.qualification_required = data['qualification_required']
            if 'experience_required' in data: vacancy.experience_required = data['experience_required']
            if 'description' in data: vacancy.description = data['description']
            
            vacancy.save()
            return JsonResponse({'success': True, 'message': 'Job vacancy updated successfully'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
            
    elif request.method == 'DELETE':
        user = get_user_from_request(request)
        if not is_admin(user):
            return JsonResponse({'error': 'Unauthorized: Admin access required'}, status=403)
            
        try:
            job_id = request.GET.get('id')
            if not job_id:
                return JsonResponse({'error': 'Job ID required'}, status=400)
                
            job = get_object_or_404(JobVacancy, id=job_id)
            job.delete()
            return JsonResponse({'success': True, 'message': 'Job vacancy deleted successfully'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
            
    return JsonResponse({'error': 'Invalid request method'}, status=405)


@csrf_exempt
def apply_job_view(request):
    user = get_user_from_request(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    if request.method == 'GET':
        # List of applications submitted by this user
        applications = JobApplication.objects.filter(user=user).select_related('job').order_by('-applied_at')
        list_data = []
        for app in applications:
            # Try to get interview details if scheduled
            interview_info = None
            interview = Interview.objects.filter(application=app).first()
            if interview:
                interview_info = {
                    'date_time': interview.date_time.strftime('%Y-%m-%d %H:%M'),
                    'mode': interview.mode,
                    'details': interview.details,
                    'result': interview.result
                }
                
            list_data.append({
                'id': app.id,
                'job_title': app.job.title,
                'department': app.job.department,
                'status': app.status,
                'applied_at': app.applied_at.strftime('%Y-%m-%d'),
                'interview': interview_info
            })
        return JsonResponse(list_data, safe=False)
        
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            job_id = data.get('job_id')
            
            if not job_id:
                return JsonResponse({'error': 'Job ID required'}, status=400)
                
            job = get_object_or_404(JobVacancy, id=job_id)
            
            # Ensure profile exists for applicant
            profile, created = FacultyProfile.objects.get_or_create(user=user, defaults={'full_name': user.email})
            if not profile.full_name:
                profile.full_name = user.email
                profile.save()

                
            if JobApplication.objects.filter(job=job, user=user).exists():
                return JsonResponse({'error': 'You have already applied for this job'}, status=400)
                
            app = JobApplication.objects.create(job=job, user=user, status='applied')
            
            # Send Notification
            Notification.objects.create(
                user=user,
                title="Job Applied",
                message=f"Your application for the vacancy '{job.title}' in the {job.department} department has been successfully submitted."
            )
            return JsonResponse({'success': True, 'message': 'Applied successfully'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
            
    return JsonResponse({'error': 'Invalid request method'}, status=405)

@csrf_exempt
def admin_applications_view(request):
    user = get_user_from_request(request)
    if not is_admin(user):
        return JsonResponse({'error': 'Unauthorized: Admin access required'}, status=403)
        
    if request.method == 'GET':
        applications = JobApplication.objects.all().select_related('job', 'user').order_by('-applied_at')
        list_data = []
        for app in applications:
            faculty_profile = FacultyProfile.objects.filter(user=app.user).first()
            # Try to get interview details
            interview_info = None
            interview = Interview.objects.filter(application=app).first()
            if interview:
                interview_info = {
                    'date_time': interview.date_time.strftime('%Y-%m-%d %H:%M'),
                    'mode': interview.mode,
                    'details': interview.details,
                    'result': interview.result
                }
                
            list_data.append({
                'id': app.id,
                'job_id': app.job.id,
                'job_title': app.job.title,
                'department': app.job.department,
                'applicant_email': app.user.email,
                'applicant_name': faculty_profile.full_name if faculty_profile else app.user.email,
                'applicant_phone': faculty_profile.phone if faculty_profile else '',
                'applicant_qualification': faculty_profile.qualification if faculty_profile else '',
                'applicant_experience': faculty_profile.experience if faculty_profile else '',
                'applicant_skills': faculty_profile.skills if faculty_profile else '',
                'applicant_resume': faculty_profile.resume_url.url if faculty_profile and faculty_profile.resume_url else '',
                'status': app.status,
                'applied_at': app.applied_at.strftime('%Y-%m-%d'),
                'interview': interview_info
            })
        return JsonResponse(list_data, safe=False)
        
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            app_id = data.get('application_id')
            action = data.get('action') # shortlist, approve (select), reject
            
            if not app_id or not action:
                return JsonResponse({'error': 'Application ID and Action are required'}, status=400)
                
            app = get_object_or_404(JobApplication, id=app_id)
            
            if action == 'shortlist':
                app.status = 'shortlisted'
                Notification.objects.create(
                    user=app.user,
                    title="Application Shortlisted",
                    message=f"Congratulations! Your application for the position of '{app.job.title}' has been shortlisted. We will schedule your interview shortly."
                )
            elif action == 'approve':
                app.status = 'approved'
                # If there's an interview, mark it as selected
                interview = Interview.objects.filter(application=app).first()
                if interview:
                    interview.result = 'selected'
                    interview.save()
                    
                Notification.objects.create(
                    user=app.user,
                    title="Congratulations! Selection Notification",
                    message=f"We are pleased to inform you that you have been SELECTED for the position of '{app.job.title}' in the {app.job.department} department. The management will reach out to you with details."
                )
            elif action == 'reject':
                app.status = 'rejected'
                # If there's an interview, mark it as rejected
                interview = Interview.objects.filter(application=app).first()
                if interview:
                    interview.result = 'rejected'
                    interview.save()
                    
                Notification.objects.create(
                    user=app.user,
                    title="Application Update",
                    message=f"Thank you for your interest in the position of '{app.job.title}'. We regret to inform you that your application was not selected. We wish you all the best."
                )
            else:
                return JsonResponse({'error': 'Invalid action'}, status=400)
                
            app.save()
            return JsonResponse({'success': True, 'message': f'Application status updated to {app.status}'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
            
    return JsonResponse({'error': 'Invalid request method'}, status=405)

@csrf_exempt
def schedule_interview_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request method'}, status=405)
        
    user = get_user_from_request(request)
    if not is_admin(user):
        return JsonResponse({'error': 'Unauthorized: Admin access required'}, status=403)
        
    try:
        data = json.loads(request.body)
        app_id = data.get('application_id')
        date_time_str = data.get('date_time') # Format: 'YYYY-MM-DD HH:MM' or similar
        mode = data.get('mode', 'offline') # online / offline
        details = data.get('details', '') # URL link or Classroom number
        
        if not app_id or not date_time_str:
            return JsonResponse({'error': 'Application ID and Date-Time are required'}, status=400)
            
        app = get_object_or_404(JobApplication, id=app_id)
        
        # Parse datetime
        dt = datetime.strptime(date_time_str, '%Y-%m-%dT%H:%M') # Input type="datetime-local" format
        
        interview, created = Interview.objects.get_or_create(
            application=app,
            defaults={'date_time': dt, 'mode': mode, 'details': details}
        )
        
        if not created:
            interview.date_time = dt
            interview.mode = mode
            interview.details = details
            interview.result = 'pending'
            interview.save()
            
        # Update application status if it was just 'applied'
        if app.status == 'applied':
            app.status = 'shortlisted'
            app.save()
            
        # Create notification for applicant
        Notification.objects.create(
            user=app.user,
            title="Interview Scheduled",
            message=f"An interview has been scheduled for your application '{app.job.title}'. Mode: {mode.upper()}. Date/Time: {dt.strftime('%Y-%m-%d %I:%M %p')}. Details: {details}."
        )
        
        return JsonResponse({'success': True, 'message': 'Interview scheduled successfully'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def notifications_view(request):
    user = get_user_from_request(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    if request.method == 'GET':
        notifications = Notification.objects.filter(user=user).order_by('-created_at')
        list_data = []
        for n in notifications:
            list_data.append({
                'id': n.id,
                'title': n.title,
                'message': n.message,
                'is_read': n.is_read,
                'created_at': n.created_at.strftime('%Y-%m-%d %H:%M')
            })
        return JsonResponse(list_data, safe=False)
        
    elif request.method == 'POST':
        # Mark all notifications as read
        Notification.objects.filter(user=user).update(is_read=True)
        return JsonResponse({'success': True, 'message': 'All notifications marked as read'})
        
    return JsonResponse({'error': 'Invalid request method'}, status=405)

@csrf_exempt
def admin_stats_view(request):
    user = get_user_from_request(request)
    if not is_admin(user):
        return JsonResponse({'error': 'Unauthorized: Admin access required'}, status=403)
        
    if request.method == 'GET':
        total_vacancies = JobVacancy.objects.count()
        total_applications = JobApplication.objects.count()
        total_shortlisted = JobApplication.objects.filter(status='shortlisted').count()
        total_selected = JobApplication.objects.filter(status='approved').count()
        
        return JsonResponse({
            'total_vacancies': total_vacancies,
            'total_applications': total_applications,
            'total_shortlisted': total_shortlisted,
            'total_selected': total_selected
        })
        
    return JsonResponse({'error': 'Invalid request method'}, status=405)
