#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod documents;
use documents::{open_project, save_pdf, save_project, Documents};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{Emitter, Manager};
#[derive(Default)]
struct Jobs(Mutex<HashMap<String, Arc<AtomicBool>>>);
impl Jobs {
    fn start(&self, job: String) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        // UI controllers cancel obsolete work explicitly. Different panels may
        // compute independently; a preview must not cancel a focus/compare job.
        if let Some(old) = self.0.lock().unwrap().insert(job, flag.clone()) {
            old.store(true, Ordering::Relaxed);
        }
        flag
    }
    fn cancel(&self, job: &str) {
        if let Some(flag) = self.0.lock().unwrap().get(job) {
            flag.store(true, Ordering::Relaxed);
        }
    }
    fn finish(&self, job: &str, flag: &Arc<AtomicBool>) {
        let mut jobs = self.0.lock().unwrap();
        if jobs
            .get(job)
            .is_some_and(|current| Arc::ptr_eq(current, flag))
        {
            jobs.remove(job);
        }
    }
}
#[tauri::command]
fn examples() -> Vec<easyoptics::Project> {
    easyoptics::examples()
}
#[tauri::command]
fn cancel(job: String, state: tauri::State<Jobs>) {
    state.cancel(&job);
}
#[tauri::command]
async fn compute(
    app: tauri::AppHandle,
    job: String,
    request: easyoptics::Request,
) -> Result<serde_json::Value, String> {
    let flag = app.state::<Jobs>().start(job.clone());
    let _ = app.emit(
        "calculation",
        serde_json::json!({"job":job,"stage":"running"}),
    );
    let worker_flag = flag.clone();
    let progress_app = app.clone();
    let progress_job = job.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        easyoptics::execute_with_progress(request, &worker_flag, &mut |progress| {
            let _ = progress_app.emit(
                "optimization-progress",
                serde_json::json!({"job":progress_job,"progress":progress}),
            );
        })
    })
    .await
    .map_err(|e| e.to_string());
    app.state::<Jobs>().finish(&job, &flag);
    let _ = app.emit(
        "calculation",
        serde_json::json!({"job":job,"stage":"finished"}),
    );
    result?
}

fn main() {
    tauri::Builder::default()
        .manage(Jobs::default())
        .manage(Documents::default())
        .invoke_handler(tauri::generate_handler![
            examples,
            compute,
            cancel,
            open_project,
            save_project,
            save_pdf
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run EasyOpticSim");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn independent_panels_cancel_only_their_own_jobs() {
        let jobs = Jobs::default();
        let preview = jobs.start("preview".into());
        let scan = jobs.start("scan".into());
        assert!(!preview.load(Ordering::Relaxed));
        assert!(!scan.load(Ordering::Relaxed));
        jobs.cancel("preview");
        assert!(preview.load(Ordering::Relaxed));
        assert!(!scan.load(Ordering::Relaxed));
        let replacement = jobs.start("scan".into());
        assert!(scan.load(Ordering::Relaxed));
        assert!(!replacement.load(Ordering::Relaxed));
        jobs.finish("scan", &scan);
        jobs.cancel("scan");
        assert!(replacement.load(Ordering::Relaxed));
        jobs.finish("scan", &replacement);
        assert!(!jobs.0.lock().unwrap().contains_key("scan"));
    }
}
