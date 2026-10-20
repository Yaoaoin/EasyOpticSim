use std::{
    collections::HashSet,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};
#[derive(Default)]
pub struct Documents(pub Mutex<HashSet<PathBuf>>);
pub fn read(path: &Path) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    if file.metadata().map_err(|e| e.to_string())?.len() > 4_000_000 {
        return Err("Project exceeds 4 MB".into());
    }
    let mut text = String::new();
    file.take(4_000_001)
        .read_to_string(&mut text)
        .map_err(|e| e.to_string())?;
    if text.len() > 4_000_000 {
        return Err("Project exceeds 4 MB".into());
    }
    Ok(text)
}
pub fn write(path: &Path, content: &str) -> Result<(), String> {
    if content.len() > 4_000_000 {
        return Err("Project exceeds 4 MB".into());
    }
    let parent = path.parent().ok_or("Invalid destination")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temp.write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}
pub fn write_pdf(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if bytes.len() > 32_000_000 || !bytes.starts_with(b"%PDF-") {
        return Err("Invalid PDF or PDF exceeds 32 MB".into());
    }
    let parent = path.parent().ok_or("Invalid destination")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temp.write_all(bytes).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub async fn save_pdf(name: String, bytes: Vec<u8>) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if bytes.len() > 32_000_000 || !bytes.starts_with(b"%PDF-") {
            return Err("Invalid PDF or PDF exceeds 32 MB".into());
        }
        let safe_name: String = name
            .chars()
            .map(|c| {
                if "<>:\"/\\|?*".contains(c) || c.is_control() {
                    '_'
                } else {
                    c
                }
            })
            .collect();
        let Some(path) = rfd::FileDialog::new()
            .set_title("导出 EasyOpticSim 技术图纸 PDF")
            .set_file_name(safe_name)
            .add_filter("PDF technical drawing", &["pdf"])
            .save_file()
        else {
            return Ok(None);
        };
        write_pdf(&path, &bytes)?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn open_project(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    use tauri::Manager;
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path)=rfd::FileDialog::new().set_title("打开 EasyOpticSim 项目").add_filter("EasyOpticSim project / prescription", &["json","csv"]).pick_file() else {return Ok(None);};
        let content=read(&path)?;
        app.state::<Documents>().0.lock().unwrap().insert(path.clone());
        Ok(Some(serde_json::json!({"name":path.file_name().unwrap_or_default().to_string_lossy(),"path":path.to_string_lossy(),"content":content})))
    }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn save_project(
    app: tauri::AppHandle,
    name: String,
    content: String,
    csv: bool,
    path: Option<String>,
) -> Result<Option<String>, String> {
    use tauri::Manager;
    tauri::async_runtime::spawn_blocking(move || {
        let path = if let Some(path) = path {
            let p = PathBuf::from(path);
            if csv || !app.state::<Documents>().0.lock().unwrap().contains(&p) {
                return Err("Please use Save As to select a destination".into());
            }
            p
        } else {
            let safe_name: String = name
                .chars()
                .map(|c| {
                    if "<>:\"/\\|?*".contains(c) || c.is_control() {
                        '_'
                    } else {
                        c
                    }
                })
                .collect();
            let Some(p) = rfd::FileDialog::new()
                .set_title(if csv {
                    "导出处方 CSV"
                } else {
                    "保存 EasyOpticSim 项目"
                })
                .set_file_name(safe_name)
                .add_filter(
                    "OSS project / prescription",
                    &[if csv { "csv" } else { "json" }],
                )
                .save_file()
            else {
                return Ok(None);
            };
            p
        };
        write(&path, &content)?;
        app.state::<Documents>()
            .0
            .lock()
            .unwrap()
            .insert(path.clone());
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pdf_atomic_export_and_invalid_overwrite_preserve_original() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("400mm 技术图纸.pdf");
        let bytes = b"%PDF-1.7\nfirst\n%%EOF";
        write_pdf(&path, bytes).unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), bytes);
        write_pdf(&path, b"%PDF-1.7\nsecond\n%%EOF").unwrap();
        assert!(write_pdf(&path, b"not a PDF").is_err());
        assert_eq!(std::fs::read(&path).unwrap(), b"%PDF-1.7\nsecond\n%%EOF");
        assert!(write_pdf(&path, &vec![b' '; 32_000_001]).is_err());
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    }
    #[test]
    fn atomic_save_reopen_replace_and_failure_preserve_original() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("镜片.oos.json");
        let mut p = easyoptics::examples().remove(0);
        p.schema_version = 2;
        p.surfaces[1].mechanical = Some(easyoptics::MechanicalEdge {
            semi_diameter: 15.,
            shape: easyoptics::EdgeShape::Flat,
        });
        let text = serde_json::to_string_pretty(&p).unwrap();
        write(&path, &text).unwrap();
        assert_eq!(read(&path).unwrap(), text);
        let q: easyoptics::Project = serde_json::from_str(&read(&path).unwrap()).unwrap();
        assert_eq!(
            q.surfaces[1].mechanical.as_ref().unwrap().semi_diameter,
            15.
        );
        write(&path, "second revision").unwrap();
        assert_eq!(read(&path).unwrap(), "second revision");
        assert!(write(&path, &"x".repeat(4_000_001)).is_err());
        assert_eq!(read(&path).unwrap(), "second revision");
    }
    #[test]
    fn versioned_document_is_saved_verbatim_and_optical_prescription_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("0.4 多版本.oos.json");
        let p = easyoptics::examples().remove(4);
        let mut doc = serde_json::to_value(&p).unwrap();
        doc["workspace"] = serde_json::json!({"schema_version":1,"versions":[{"id":"baseline","name":"机械基准","created_at":"2026-10-18T00:00:00Z","note":"","prescription":p}],"focus":{"min_mm":40,"max_mm":60,"steps":31,"sampling":17,"criterion":"balanced"}});
        let text = serde_json::to_string_pretty(&doc).unwrap();
        write(&path, &text).unwrap();
        let reopened: serde_json::Value = serde_json::from_str(&read(&path).unwrap()).unwrap();
        assert_eq!(reopened, doc);
        let q: easyoptics::Project = serde_json::from_value(reopened.clone()).unwrap();
        let v: easyoptics::Project =
            serde_json::from_value(reopened["workspace"]["versions"][0]["prescription"].clone())
                .unwrap();
        let flag = std::sync::atomic::AtomicBool::new(false);
        assert_eq!(
            serde_json::to_value(easyoptics::analyze(&q, 17, &flag).unwrap()).unwrap(),
            serde_json::to_value(easyoptics::analyze(&v, 17, &flag).unwrap()).unwrap()
        );
    }
}
