@echo off
cd /d "%~dp0"
echo ==========================================
echo Setting up SamAudio Python Environment
echo ==========================================

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
) else (
    echo Virtual environment already exists.
)

echo Activating virtual environment...
call venv\Scripts\activate

echo Upgrading pip...
python -m pip install --upgrade pip

echo Installing dependencies from sam-audio...
cd sam-audio
pip install -e .

echo ==========================================
echo Setup Complete!
echo ==========================================
pause
