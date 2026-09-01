from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=[('admin', 'Admin'), ('faculty', 'Faculty')], default='faculty')

    def __str__(self):
        return f"{self.user.username} - {self.role}"

class FacultyProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='faculty_profile')
    full_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20)
    qualification = models.TextField()
    experience = models.TextField()
    skills = models.TextField()
    resume_url = models.FileField(upload_to='resumes/', null=True, blank=True)

    def __str__(self):
        return self.full_name

class JobVacancy(models.Model):
    title = models.CharField(max_length=100)
    department = models.CharField(max_length=100)
    qualification_required = models.CharField(max_length=200)
    experience_required = models.CharField(max_length=100)
    description = models.TextField()
    status = models.CharField(max_length=10, choices=[('open', 'Open'), ('closed', 'Closed')], default='open')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.department})"

class JobApplication(models.Model):
    job = models.ForeignKey(JobVacancy, on_delete=models.CASCADE, related_name='applications')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='applications')
    status = models.CharField(
        max_length=20, 
        choices=[
            ('applied', 'Applied'), 
            ('shortlisted', 'Shortlisted'), 
            ('approved', 'Approved'), 
            ('rejected', 'Rejected')
        ], 
        default='applied'
    )
    applied_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('job', 'user')

    def __str__(self):
        return f"{self.user.username} applied to {self.job.title}"

class Interview(models.Model):
    application = models.OneToOneField(JobApplication, on_delete=models.CASCADE, related_name='interview')
    date_time = models.DateTimeField()
    mode = models.CharField(max_length=10, choices=[('online', 'Online'), ('offline', 'Offline')], default='offline')
    details = models.TextField()
    result = models.CharField(
        max_length=15, 
        choices=[
            ('pending', 'Pending'), 
            ('selected', 'Selected'), 
            ('rejected', 'Rejected')
        ], 
        default='pending'
    )

    def __str__(self):
        return f"Interview for {self.application.user.username} - {self.mode}"

class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=100)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notification for {self.user.username}: {self.title}"
