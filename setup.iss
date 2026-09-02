; Script generated for Inno Setup Compiler
#define MyAppName "POS Books"
#define MyAppVersion "0.37.0"
#define MyAppPublisher "AlqaTecg"
#define MyAppURL "http://alqatech.in/"
#define MyAppExeName "POS Books.exe"

[Setup]
; App Metadata
AppId={{8B1A2C3D-4E5F-6789-ABCD-EF0123456789}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Installation Path (Program Executable)
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Output Configuration
OutputDir=dist_electron\installer
OutputBaseFilename=POS_Books_Setup_v{#MyAppVersion}
SetupIconFile=build\installericon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern

; Admin Rights (Lowest required so it works without forced UAC elevation if desired)
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Copy all unpacked Electron files from dist_electron/bundled/win-unpacked
Source: "dist_electron\bundled\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
var
  DataDirPage: TInputDirWizardPage;

procedure InitializeWizard;
begin
  // Create Custom Page to ask for Data & Database directory
  DataDirPage := CreateInputDirPage(
    wpSelectDir,
    'Select Data & Database Location',
    'Where should POS Books store company databases, images, and backups?',
    'Select the folder where database files and attachments will be saved. (Do not choose Program Files due to Windows write restrictions):',
    False,
    ''
  );
  
  // Set default data directory to User Documents folder
  DataDirPage.Add('');
  DataDirPage.Values[0] := ExpandConstant('{userdocs}\POS Books Data');
end;

function GetDataDir(Param: String): String;
begin
  Result := DataDirPage.Values[0];
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigPath: String;
  ConfigContent: String;
begin
  if CurStep = ssPostInstall then
  begin
    // Create the chosen data directory if it doesn't exist
    ForceDirectories(DataDirPage.Values[0]);
    
    // Save configuration file into %APPDATA%\POS Books\data_config.json
    ConfigPath := ExpandConstant('{userappdata}\{#MyAppName}');
    ForceDirectories(ConfigPath);
    
    ConfigContent := '{"dataDirectory": "' + AddBackslash(DataDirPage.Values[0]) + '"}';
    SaveStringToFile(ConfigPath + '\data_config.json', ConfigContent, False);
  end;
end;